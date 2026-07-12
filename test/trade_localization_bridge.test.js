"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("native item bridge renders bilingual labels without changing English item identities", () => {
  let source = fs.readFileSync("trade-localization-bridge.js", "utf8");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { localizeTradeItemsPayload, localizeTradeStatsPayload, writeNativeTradeCache, clearNativeTradeCaches };\n})();"
  );
  const sandbox = {
    window: {
      addEventListener() {},
      fetch() {},
      setTimeout() {}
    },
    localStorage: { removeItem() {}, setItem() {}, getItem() { return null; } },
    location: { href: "https://www.pathofexile.com/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "trade-localization-bridge.js" });
  const payload = {
    result: [
      {
        id: "accessory",
        entries: [
          { type: "Gold Ring" },
          { type: "Gold Ring", text: "Andvarius Gold Ring", flags: { unique: true } },
          { type: "Unknown Ring" }
        ]
      }
    ]
  };
  const localized = sandbox.window.__testHooks.localizeTradeItemsPayload(payload, {
    enabled: true,
    locale: "zh_TW",
    items: { "Gold Ring": { zh_CN: "金环", zh_TW: "金環" } }
  });
  const disabled = sandbox.window.__testHooks.localizeTradeItemsPayload(payload, {
    enabled: false,
    locale: "zh_TW",
    items: { "Gold Ring": { zh_CN: "金环", zh_TW: "金環" } }
  });

  assert.deepStrictEqual(structuredClone(localized), {
    result: [
      {
        id: "accessory",
        entries: [
          { type: "Gold Ring", text: "金環 (Gold Ring)" },
          { type: "Gold Ring", text: "Andvarius Gold Ring", flags: { unique: true } },
          { type: "Unknown Ring" }
        ]
      }
    ]
  });
  assert.deepStrictEqual(structuredClone(disabled), payload);
});

test("native item cache stores bilingual labels without changing the English query type", () => {
  let source = fs.readFileSync("trade-localization-bridge.js", "utf8");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { writeNativeTradeCache, clearNativeTradeCaches };\n})();"
  );
  const stored = new Map([["lscache-trade2items-cacheexpiration", "old-expiry"]]);
  const sandbox = {
    window: {
      addEventListener() {},
      fetch() {},
      setTimeout() {}
    },
    localStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); },
      removeItem(key) { stored.delete(key); }
    },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "trade-localization-bridge.js" });
  sandbox.window.__testHooks.writeNativeTradeCache(
    "items",
    {
      result: [
        {
          entries: [
            { type: "Gold Ring" },
            { type: "Gold Ring", text: "Andvarius", flags: { unique: true } }
          ]
        }
      ]
    },
    {
      enabled: true,
      locale: "zh_CN",
      cacheVersion: "1.3.1:2:zh_CN",
      items: {
        "Gold Ring": { zh_CN: "金光戒指" },
        Andvarius: { zh_CN: "安德瓦里乌斯" }
      }
    }
  );

  assert.deepStrictEqual(structuredClone(JSON.parse(stored.get("lscache-trade2items"))), [
    {
      entries: [
        { type: "Gold Ring", text: "金光戒指 (Gold Ring)" },
        { type: "Gold Ring", text: "安德瓦里乌斯 (Andvarius)", flags: { unique: true } }
      ]
    }
  ]);
  assert.strictEqual(stored.get("poe2-marketwright:trade-native-search-localization"), "1.3.1:2:zh_CN");
  assert.strictEqual(stored.has("lscache-trade2items-cacheexpiration"), false);
});

test("native stat cache uses stable stat IDs and static labels use the same cache pipeline", () => {
  let source = fs.readFileSync("trade-localization-bridge.js", "utf8");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { localizeTradeStatsPayload, localizeTradeTextPayload };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, fetch() {}, setTimeout() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "trade-localization-bridge.js" });
  const config = {
    enabled: true,
    locale: "zh_CN",
    stats: { "explicit.stat_life": { zh_CN: "+# 最大生命" } },
    strings: { "Item Category": { zh_CN: "物品类型" } }
  };
  const stats = sandbox.window.__testHooks.localizeTradeStatsPayload(
    {
      result: [
        {
          entries: [
            { id: "explicit.stat_life", text: "+# to maximum Life" },
            { id: "explicit.stat_unknown", text: "Unknown Stat" }
          ]
        }
      ]
    },
    config
  );
  const staticData = sandbox.window.__testHooks.localizeTradeTextPayload(
    { result: { category: { label: "Item Category" } } },
    config
  );

  const localizedEntries = structuredClone(stats.result[0].entries);
  assert.deepStrictEqual(localizedEntries, [
    { id: "explicit.stat_life", text: "+# 最大生命 (+# to maximum Life)" },
    { id: "explicit.stat_unknown", text: "Unknown Stat" }
  ]);
  assert.deepStrictEqual(
    structuredClone(sandbox.window.__testHooks.localizeTradeStatsPayload(stats, config).result[0].entries),
    localizedEntries
  );
  assert.deepStrictEqual(structuredClone(staticData), { result: { category: { label: "物品类型" } } });
});

test("bridge clears unmarked native Trade caches left by another extension", () => {
  const stored = new Map([
    ["lscache-trade2items", "other-extension-localized-items"],
    ["lscache-trade2items-cacheexpiration", "never"]
  ]);
  const sandbox = {
    window: {
      addEventListener() {},
      fetch() {},
      setTimeout() {}
    },
    localStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); },
      removeItem(key) { stored.delete(key); }
    },
    console
  };
  vm.runInNewContext(fs.readFileSync("trade-localization-bridge.js", "utf8"), sandbox, {
    filename: "trade-localization-bridge.js"
  });
  assert.strictEqual(stored.size, 0);
});

test("manifest starts the native item bridge before the Trade application", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  const bridge = manifest.content_scripts.find((entry) => entry.world === "MAIN");
  const bootstrap = manifest.content_scripts.find((entry) => entry.js?.includes("trade-localization-bootstrap.js"));

  assert.deepStrictEqual(bridge?.js, ["trade-localization-bridge.js"]);
  assert.strictEqual(bridge?.run_at, "document_start");
  assert.strictEqual(bootstrap?.run_at, "document_start");
});
