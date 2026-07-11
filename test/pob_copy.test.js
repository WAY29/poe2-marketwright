"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("pob builder outputs create custom item text", async () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("pob-copy.js", "utf8"), sandbox, {
    filename: "pob-copy.js"
  });

  const builder = sandbox.Poe2MarketwrightPobCopy.createItemTextBuilder([
    { key: "implicitMods", tag: "implicit" },
    { key: "explicitMods", tag: null }
  ]);
  const text = builder.buildPobFullText({
    rarity: "Rare",
    name: "Dawn Veil",
    typeLine: "Expert Omen Wand",
    properties: [{ name: "[Quality]", values: [["+20%"]] }],
    implicitMods: [{ description: "[explicit.stat_fire|+20% to Fire Resistance]" }],
    explicitMods: [
      { description: "+30 to Spirit" },
      { description: "+12% increased Attack Speed" },
      { description: "# to skip this placeholder" }
    ]
  });

  const result = structuredClone(text.split("\n"));
  assert.deepStrictEqual(result, ["Rarity: RARE", "Dawn Veil", "Expert Omen Wand", "Quality: 20", "Implicits: 1", "{implicit}+20% to Fire Resistance", "+30 to Spirit", "+12% increased Attack Speed"]);
});

test("page bridge forwards trade fetch when pob copy is enabled", async () => {
  const listeners = [];
  const messages = [];
  const responseBody = JSON.stringify({ result: [{ id: "item-1", item: { name: "Dawn Veil" } }] });
  const window = {
    app: { $data: { static_: { knownStats: [] } } },
    addEventListener(type, listener) {
      if (type === "message") listeners.push(listener);
    },
    postMessage(message) {
      messages.push(message);
    },
    fetch() {
      return Promise.resolve({
        clone() {
          return { text: () => Promise.resolve(responseBody) };
        }
      });
    }
  };

  vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), {
    window,
    console
  }, { filename: "page-bridge.js" });

  listeners[0]({
    source: window,
    data: {
      source: "poe2-marketwright",
      type: "POE2_MARKETWRIGHT_UPDATE",
      payload: { enabled: false, pobCopyEnabled: true }
    }
  });
  await window.fetch("/api/trade2/fetch/query-1");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const result = structuredClone(messages.filter((message) => message.source === "poe2-marketwright-pob-copy"));
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright-pob-copy", "url": "/api/trade2/fetch/query-1", "body": "{\"result\":[{\"id\":\"item-1\",\"item\":{\"name\":\"Dawn Veil\"}}]}"}]);
});

test("page bridge reads the league from the trade page search url", async () => {
  const listeners = [];
  const messages = [];
  const responseBody = JSON.stringify({
    result: [{ id: "item-1", listing: { price: { type: "~price", amount: 2, currency: "exalted" } } }]
  });
  const window = {
    app: { $data: { static_: { knownStats: [] } } },
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/HC%20Runes%20of%20Aldur/query-1"
    },
    addEventListener(type, listener) {
      if (type === "message") listeners.push(listener);
    },
    postMessage(message) {
      messages.push(message);
    },
    fetch() {
      return Promise.resolve({
        clone() {
          return { text: () => Promise.resolve(responseBody) };
        }
      });
    }
  };

  vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), {
    window,
    console
  }, { filename: "page-bridge.js" });

  listeners[0]({
    source: window,
    data: {
      source: "poe2-marketwright",
      type: "POE2_MARKETWRIGHT_UPDATE",
      payload: { enabled: false, pobCopyEnabled: false, currencyConversionEnabled: true }
    }
  });
  await window.fetch("/api/trade2/fetch/query-1?query=query-hc");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const result = structuredClone(messages.filter((message) => message.source === "poe2-marketwright-currency-conversion"));
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright-currency-conversion", "type": "fetch", "league": "HC Runes of Aldur", "queryId": "query-hc", "searchUrl": "https://www.pathofexile.com/trade2/search/poe2/HC%20Runes%20of%20Aldur/query-1", "tradeUrl": "/api/trade2/fetch/query-1?query=query-hc", "body": "{\"result\":[{\"id\":\"item-1\",\"listing\":{\"price\":{\"type\":\"~price\",\"amount\":2,\"currency\":\"exalted\"}}}]}"}]);
});

test("page bridge uses the page search url instead of api search requests", async () => {
  const listeners = [];
  const messages = [];
  const fetchBodies = new Map([
    ["/api/trade2/search/Dawn%20of%20the%20Hunt", JSON.stringify({ id: "query-hunt" })],
    ["/api/trade2/search/Runes%20of%20Aldur", JSON.stringify({ id: "query-runes" })],
    ["/api/trade2/fetch/item-1?query=query-hunt", JSON.stringify({ result: [{ id: "item-1" }] })]
  ]);
  const window = {
    app: { $data: { static_: { knownStats: [] } } },
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-hunt"
    },
    addEventListener(type, listener) {
      if (type === "message") listeners.push(listener);
    },
    postMessage(message) {
      messages.push(message);
    },
    fetch(url) {
      const body = fetchBodies.get(url) || "{}";
      return Promise.resolve({
        clone() {
          return { text: () => Promise.resolve(body) };
        }
      });
    }
  };

  vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), { window, console }, {
    filename: "page-bridge.js"
  });
  listeners[0]({
    source: window,
    data: {
      source: "poe2-marketwright",
      type: "POE2_MARKETWRIGHT_UPDATE",
      payload: { enabled: false, pobCopyEnabled: false, currencyConversionEnabled: true }
    }
  });

  await window.fetch("/api/trade2/search/Dawn%20of%20the%20Hunt");
  await window.fetch("/api/trade2/search/Runes%20of%20Aldur");
  await window.fetch("/api/trade2/fetch/item-1?query=query-hunt");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const result = structuredClone(messages.filter((message) => message.source === "poe2-marketwright-currency-conversion"));
  assert.deepStrictEqual(result.at(-1), {"source": "poe2-marketwright-currency-conversion", "type": "fetch", "league": "Dawn of the Hunt", "queryId": "query-hunt", "searchUrl": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-hunt", "tradeUrl": "/api/trade2/fetch/item-1?query=query-hunt", "body": "{\"result\":[{\"id\":\"item-1\"}]}"});
});
