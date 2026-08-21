"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("save state ignores invalidated extension context", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { saveState, runtime };\n})();"
  );

  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set() {
            return Promise.reject(new Error("Extension context invalidated."));
          }
        }
      }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  sandbox.PROMISE_RESULT = sandbox.window.__testHooks.saveState()
    .then(() => ({ resolved: true }))
    .catch((error) => ({ resolved: false, message: error.message }));
  const result = structuredClone(await sandbox.PROMISE_RESULT);
  assert.deepStrictEqual(result, {"resolved": true});
});

test("global language prefers the saved choice and migrates browser language", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { loadState, resolveUiLanguage };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {
      i18n: { getUILanguage: () => "zh-TW" },
      storage: {
        local: {
          get: async () => ({ poe2Trade2AffixFilterState: {} })
        }
      }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  const migrated = await hooks.loadState();
  sandbox.chrome.storage.local.get = async () => ({
    poe2Trade2AffixFilterState: { uiLanguage: "zh_CN" }
  });
  const saved = await hooks.loadState();
  sandbox.chrome.storage.local.get = async () => ({
    poe2Trade2AffixFilterState: { uiLanguage: "zh_CN", pageLanguage: "zh_TW_en" }
  });
  const split = await hooks.loadState();
  const result = structuredClone({
    migrated: migrated.uiLanguage,
    saved: saved.uiLanguage,
    savedPageLanguage: saved.pageLanguage,
    splitUiLanguage: split.uiLanguage,
    splitPageLanguage: split.pageLanguage,
    tierEnabled: migrated.tierEnabled,
    tierMode: migrated.tierMode,
    normalized: hooks.resolveUiLanguage("unsupported")
  });
  assert.deepStrictEqual(result, {
    migrated: "zh_TW",
    saved: "zh_CN",
      savedPageLanguage: "zh_CN",
      splitUiLanguage: "zh_CN",
      splitPageLanguage: "zh_TW_en",
      tierEnabled: true,
      tierMode: "minimum",
      normalized: "zh_TW"
  });
});

test("link history settings default safely and accept supported limits", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { loadState };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {
      storage: {
        local: {
          get: async () => ({ poe2Trade2AffixFilterState: {} })
        }
      }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const defaults = await sandbox.window.__testHooks.loadState();
  sandbox.chrome.storage.local.get = async () => ({
    poe2Trade2AffixFilterState: { linkHistoryEnabled: false, linkHistoryLimit: 100 }
  });
  const saved = await sandbox.window.__testHooks.loadState();
  sandbox.chrome.storage.local.get = async () => ({
    poe2Trade2AffixFilterState: { linkHistoryLimit: 25 }
  });
  const invalid = await sandbox.window.__testHooks.loadState();
  assert.deepStrictEqual(
    structuredClone({
      defaults: [defaults.linkHistoryEnabled, defaults.linkHistoryLimit],
      saved: [saved.linkHistoryEnabled, saved.linkHistoryLimit],
      invalid: invalid.linkHistoryLimit
    }),
    { defaults: [true, 50], saved: [false, 100], invalid: 50 }
  );
});

test("page language keeps non-affix Trade copy monolingual without changing extension language", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { resolveUiLanguage, resolvePageLanguage, getLocalizedDisplayText, getLocalizedTradeText, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: { i18n: { getUILanguage: () => "en-US" } }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "zh_CN", pageLanguage: "zh_CN_en" };
  hooks.runtime.tradeLocalization = {
    strings: {
      "Rider Bow": { en: "Rider Bow", zh_CN: "骑射之弓", zh_TW: "騎士之弓" }
    },
    clientStrings: {
      Requires: { en: "Requires", zh_CN: "Requires", zh_TW: "需要" }
    }
  };
  const extension = hooks.getLocalizedDisplayText(
    { en: "Rider Bow", zh_CN: "骑射之弓", zh_TW: "騎士之弓" },
    "Rider Bow"
  );
  const pageCopy = hooks.getLocalizedTradeText("Rider Bow");
  const clientCopy = hooks.getLocalizedTradeText("Requires");
  hooks.runtime.state.pageLanguage = "zh_TW_en";
  const traditional = hooks.getLocalizedTradeText("Rider Bow");
  const clientTraditional = hooks.getLocalizedTradeText("Requires");
  assert.deepStrictEqual(
    structuredClone({ extension, pageCopy, clientCopy, traditional, clientTraditional, uiLanguage: hooks.resolveUiLanguage("zh_CN_en"), pageLanguage: hooks.resolvePageLanguage("zh_CN_en") }),
    {
      extension: "骑射之弓",
      pageCopy: "骑射之弓",
      clientCopy: "Requires",
      traditional: "騎士之弓",
      clientTraditional: "需要",
      uiLanguage: "en",
      pageLanguage: "zh_CN_en"
    }
  );
});

test("Trade search uses no extension-owned suggestion component", () => {
  const source = fs.readFileSync("content.js", "utf8");
  assert.doesNotMatch(source, /poe2-marketwright-search-suggestions/);
  assert.doesNotMatch(source, /getTradeSearchCandidates/);
  assert.doesNotMatch(source, /getNativeTradeItemSearchQuery/);
});

test("Tier bridge sends mappings with its first update and the active category", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { syncTierBridge, runtime };\n})();"
  );
  const messages = [];
  const sandbox = {
    window: {
      addEventListener() {},
      innerWidth: 1280,
      innerHeight: 900,
      postMessage(message) {
        messages.push(message);
      }
    },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.data = {
    tierMappings: {
      Rings: {
        "explicit.stat_cold_damage": [{ tier: 1, min: 20.5 }]
      }
    },
    pageCategories: { Rings: { label: "Rings" } }
  };
  hooks.runtime.state = { uiLanguage: "en", tierEnabled: true, tierMode: "minimum" };

  hooks.syncTierBridge({ kind: "page", id: "Rings" });
  hooks.syncTierBridge({ kind: "page", id: "Rings" });

  assert.equal(messages.length, 1);
  assert.deepStrictEqual(structuredClone(messages[0].payload), {
    tierMappings: {
      Rings: { "explicit.stat_cold_damage": [{ tier: 1, min: 20.5 }] }
    },
    tierPageId: "Rings",
    tierPageIds: ["Rings"],
    tierEnabled: true,
    tierMode: "minimum",
    tierPageLabels: { Rings: "Rings" },
    tierLabel: "Tier",
    corruptedGemLevelLabel: "Corrupted +1 Final Gem Level",
    corruptedGemLevelInvalid: "Enter a whole number from 2 to 21"
  });

  hooks.runtime.data.logicalCategories = {
    Gloves: { pageSlugs: ["Gloves_int", "Gloves_dex", "Gloves_str"] }
  };
  hooks.syncTierBridge({ kind: "logical", id: "Gloves" });
  assert.deepStrictEqual(messages[1].payload.tierPageIds, ["Gloves_int", "Gloves_dex", "Gloves_str"]);
  assert.equal(messages[1].payload.tierPageId, null);
});

test("Tier mode buttons reflect the active mode and disabled state", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { updateTierControls, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  const makeButton = (mode) => ({
    dataset: { tierMode: mode },
    classList: {
      active: false,
      toggle(_name, active) {
        this.active = active;
      }
    },
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  });
  const minimum = makeButton("minimum");
  const exact = makeButton("exact");
  const toggle = { setAttribute() {} };
  hooks.runtime.ui = { tierEnabled: toggle, tierModeOptions: [minimum, exact] };
  hooks.runtime.state = { tierEnabled: true, tierMode: "exact" };

  hooks.updateTierControls();

  assert.equal(minimum.classList.active, false);
  assert.equal(minimum.attributes["aria-checked"], "false");
  assert.equal(minimum.disabled, false);
  assert.equal(exact.classList.active, true);
  assert.equal(exact.attributes["aria-checked"], "true");

  hooks.runtime.state.tierEnabled = false;
  hooks.updateTierControls();
  assert.equal(minimum.disabled, true);
  assert.equal(exact.disabled, true);
});

test("sidebar position buttons reflect the saved position", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setSidebarPosition, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  const makeButton = (position) => ({
    dataset: { sidebarPosition: position },
    classList: {
      active: false,
      toggle(_name, active) {
        this.active = active;
      }
    },
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  });
  const left = makeButton("left");
  const right = makeButton("right");
  hooks.runtime.ui = {
    root: { classList: { toggle() {} }, style: {} },
    sidebarPositionOptions: [left, right]
  };
  hooks.runtime.state = { sidebarPosition: "left", collapsed: false, panelPosition: null };

  await hooks.setSidebarPosition("right");

  assert.equal(left.classList.active, false);
  assert.equal(left.attributes["aria-checked"], "false");
  assert.equal(right.classList.active, true);
  assert.equal(right.attributes["aria-checked"], "true");
});

test("changing the Trade page language clears every native Trade search cache", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { clearNativeTradeItemSearchCache };\n})();"
  );
  const stored = new Map([
    ["lscache-trade2items", "localized-items"],
    ["lscache-trade2items-cacheexpiration", "never"],
    ["lscache-trade2stats", "localized-stats"],
    ["lscache-trade2stats-cacheexpiration", "never"],
    ["lscache-trade2data", "localized-static"],
    ["lscache-trade2data-cacheexpiration", "never"],
    ["lscache-trade2filters", "localized-filters"],
    ["lscache-trade2filters-cacheexpiration", "never"],
    ["poe2-marketwright:trade-native-search-localization", "1.3.1:2:zh_CN"],
    ["poe2-marketwright:trade-item-localization", "legacy"]
  ]);
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    localStorage: { removeItem(key) { stored.delete(key); } },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  sandbox.window.__testHooks.clearNativeTradeItemSearchCache();
  assert.strictEqual(stored.size, 0);
});

test("Trade affixes use their official stat ID and are the only bilingual page text", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLocalizedTradeText, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "zh_TW", pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeLocalization = { strings: {} };
  hooks.runtime.tradeStatsById = new Map([
    [
      "pseudo.pseudo_total_cold_resistance",
      {
        id: "pseudo.pseudo_total_cold_resistance",
        en: "+#% total to Cold Resistance",
        zh_CN: "+#% 总冰霜抗性",
        zh_TW: "+#% 冰冷抗性"
      }
    ]
  ]);
  const statElement = {
    closest(selector) {
      return selector === "[data-field^='stat.']"
        ? { getAttribute: () => "stat.pseudo.pseudo_total_cold_resistance" }
        : null;
    }
  };
  const result = structuredClone({
    affix: hooks.getLocalizedTradeText("+#% total to Cold Resistance", statElement),
    label: hooks.getLocalizedTradeText("Pseudo")
  });
  assert.deepStrictEqual(result, {
    affix: "+#% 冰冷抗性 (+#% total to Cold Resistance)",
    label: "Pseudo"
  });
});

test("Trade result affix display uses one localized line and a separate English line", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeStatDisplay, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeStatsById = new Map([
    [
      "rune.stat_map_boss_uses",
      {
        id: "rune.stat_map_boss_uses",
        en: "Empowers the Map Boss of a Map # Use Remaining",
        zh_CN: "强化带有头目的地图剩余 # 次使用",
        zh_TW: "強化帶有頭目的地圖剩餘 # 次使用"
      }
    ]
  ]);
  const statElement = {
    closest(selector) {
      return selector === "[data-field^='stat.']"
        ? { getAttribute: () => "stat.rune.stat_map_boss_uses" }
        : null;
    }
  };
  const display = hooks.getTradeStatDisplay(
    "Empowers the Map Boss of a Map # Use Remaining Empowers the Map Boss of a Map 10 Use Remaining",
    statElement
  );
  assert.deepStrictEqual(structuredClone(display), {
    primary: "強化帶有頭目的地圖剩餘 10 次使用",
    english: "Empowers the Map Boss of a Map 10 Use Remaining"
  });
});

test("Trade result localization follows the item's actual reduced modifier direction", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeStatDisplay, storeTradeResultModifierDescriptions, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeStatsById = new Map([
    [
      "explicit.stat_2282052746",
      {
        id: "explicit.stat_2282052746",
        en: "Rerolling Favours at Ritual Altars in Area costs #% increased Tribute",
        zh_CN: "区域内在驱灵祭坛重置恩典消耗的贡品提高 #%",
        zh_TW: "增加#%在區域中祭祀神壇重骰恩惠的貢禮消耗"
      }
    ]
  ]);
  hooks.storeTradeResultModifierDescriptions({
    result: [
      {
        id: "item-1",
        item: {
          explicitMods: [
            {
              hash: "stat.explicit.stat_2282052746",
              description: "Rerolling Favours at Ritual Altars in Area costs 28% reduced Tribute"
            }
          ]
        }
      }
    ]
  });
  const statElement = {
    closest(selector) {
      if (selector === "[data-field^='stat.']") {
        return { getAttribute: () => "stat.explicit.stat_2282052746" };
      }
      if (selector === "[data-id]") {
        return { getAttribute: () => "item-1" };
      }
      return null;
    }
  };
  const display = hooks.getTradeStatDisplay(
    "Rerolling Favours at Ritual Altars in Area costs 28% increased Tribute",
    statElement
  );
  assert.deepStrictEqual(structuredClone(display), {
    primary: "減少28%在區域中祭祀神壇重骰恩惠的貢禮消耗",
    english: "Rerolling Favours at Ritual Altars in Area costs 28% reduced Tribute"
  });
});

test("Trade result localizes allocated passive titles and effects inside its item popup", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeResultPassiveSkillDisplay, storeTradeResultModifierDescriptions, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeLocalization = {
    passiveSkills: {
      "20511": {
        en: {
          name: "Cremating Cries",
          effects: ["Empowered Attacks Gain 15% of Physical Damage as Extra Fire Damage"]
        },
        zh_TW: {
          name: "火化嚎叫",
          effects: ["強化攻擊獲得等同於物理傷害 15% 的額外火焰傷害"]
        }
      }
    }
  };
  hooks.storeTradeResultModifierDescriptions({
    result: [
      {
        id: "item-1",
        item: {
          explicitMods: [
            { hash: "stat.explicit.stat_2954116742|20511", description: "Allocates Cremating Cries" }
          ]
        }
      }
    ]
  });
  const passiveElement = {
    closest(selector) {
      if (selector === ".item-popup, .itemPopupContainer") return {};
      if (selector === "[data-id]") return { getAttribute: () => "item-1" };
      return null;
    }
  };
  const unrelatedElement = {
    closest(selector) {
      return selector === "[data-id]" ? { getAttribute: () => "item-1" } : null;
    }
  };
  assert.deepStrictEqual(
    structuredClone({
      title: hooks.getTradeResultPassiveSkillDisplay("Cremating Cries", passiveElement),
      effect: hooks.getTradeResultPassiveSkillDisplay(
        "Empowered Attacks Gain 15% of Physical Damage as Extra Fire Damage",
        passiveElement
      ),
      unrelated: hooks.getTradeResultPassiveSkillDisplay("Cremating Cries", unrelatedElement)
    }),
    {
      title: { primary: "火化嚎叫", english: "Cremating Cries" },
      effect: {
        primary: "強化攻擊獲得等同於物理傷害 15% 的額外火焰傷害",
        english: "Empowered Attacks Gain 15% of Physical Damage as Extra Fire Damage"
      },
      unrelated: null
    }
  );
});

test("Trade result pairs fetch mods by extended hashes when modifier.hash is rotated", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeStatDisplay, getTradeResultPassiveSkillDisplay, storeTradeResultModifierDescriptions, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeStatsById = new Map([
    [
      "enchant.stat_1671376347",
      {
        id: "enchant.stat_1671376347",
        en: "#% to Lightning Resistance",
        zh_CN: "闪电抗性 #%",
        zh_TW: "#%閃電抗性"
      }
    ],
    [
      "enchant.stat_2954116742|27009",
      {
        id: "enchant.stat_2954116742|27009",
        en: "Allocates Lust for Sacrifice",
        zh_CN: "配置 牺牲的渴望",
        zh_TW: "配置渴求獻祭"
      }
    ],
    [
      "enchant.stat_2954116742|31773",
      {
        id: "enchant.stat_2954116742|31773",
        en: "Allocates Resurging Archon",
        zh_CN: "配置 复兴执政官",
        zh_TW: "配置復行統治者"
      }
    ]
  ]);
  hooks.runtime.tradeLocalization = {
    passiveSkills: {
      "27009": {
        en: {
          name: "Lust for Sacrifice",
          effects: ["50% increased Minion Damage while you have at least two different active Offerings"]
        },
        zh_TW: {
          name: "渴求獻祭",
          effects: ["當你有至少兩個不同的獻祭生效時，增加50%召喚物傷害"]
        }
      },
      "31773": {
        en: {
          name: "Resurging Archon",
          effects: ["Archon recovery period expires 25% faster"]
        },
        zh_TW: {
          name: "復行統治者",
          effects: ["統治者增益效果恢復期加快25%"]
        }
      }
    }
  };
  hooks.storeTradeResultModifierDescriptions({
    result: [
      {
        id: "item-1",
        item: {
          enchantMods: [
            {
              hash: "stat.enchant.stat_1671376347",
              description: "Allocates [corpses17|Lust for Sacrifice]"
            },
            {
              hash: "stat.enchant.stat_2954116742|27009",
              description: "Allocates [archon7|Resurging Archon]"
            },
            {
              hash: "stat.enchant.stat_2954116742|31773",
              description: "+5% to [Resistances|Lightning Resistance]"
            }
          ],
          extended: {
            hashes: {
              enchant: [
                ["enchant.stat_1671376347", [2]],
                ["enchant.stat_2954116742|27009", [0]],
                ["enchant.stat_2954116742|31773", [1]]
              ]
            }
          },
          notableProperties: [
            { name: "Lust for Sacrifice", suffix: "27009" },
            { name: "Resurging Archon", suffix: "31773" }
          ]
        }
      }
    ]
  });
  const lightningElement = {
    closest(selector) {
      if (selector === "[data-field^='stat.']") {
        return { getAttribute: () => "stat.enchant.stat_1671376347" };
      }
      if (selector === "[data-id]") {
        return { getAttribute: () => "item-1" };
      }
      return null;
    }
  };
  const passiveElement = {
    closest(selector) {
      if (selector === ".item-popup, .itemPopupContainer") return {};
      if (selector === "[data-id]") return { getAttribute: () => "item-1" };
      return null;
    }
  };
  assert.deepStrictEqual(
    structuredClone({
      lightning: hooks.getTradeStatDisplay("#% to Lightning Resistance", lightningElement),
      firstNotable: hooks.getTradeResultPassiveSkillDisplay("Lust for Sacrifice", passiveElement),
      secondNotable: hooks.getTradeResultPassiveSkillDisplay("Resurging Archon", passiveElement),
      secondEffect: hooks.getTradeResultPassiveSkillDisplay(
        "Archon recovery period expires 25% faster",
        passiveElement
      )
    }),
    {
      lightning: {
        primary: "+5%閃電抗性",
        english: "+5% to Lightning Resistance"
      },
      firstNotable: { primary: "渴求獻祭", english: "Lust for Sacrifice" },
      secondNotable: { primary: "復行統治者", english: "Resurging Archon" },
      secondEffect: {
        primary: "統治者增益效果恢復期加快25%",
        english: "Archon recovery period expires 25% faster"
      }
    }
  );
});

test("Trade result fills additional-count tablet mods from singular catalog grammar", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeStatDisplay, storeTradeResultModifierDescriptions, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeStatsById = new Map([
    [
      "explicit.stat_120737942",
      {
        id: "explicit.stat_120737942",
        en: "Ritual Altars in Area allow rerolling Favours an additional time",
        zh_CN: "区域中的驱灵祭坛可以额外重置恩典一次",
        zh_TW: "區域中的祭祀神壇可以重骰恩賜之物額外1次"
      }
    ],
    [
      "explicit.stat_3762913035",
      {
        id: "explicit.stat_3762913035",
        en: "Unstable Breaches in Map spawn an additional Rare Monster when Stabilised",
        zh_CN: "地图中的不稳定裂隙在稳定时会生成一个额外的稀有怪物",
        zh_TW: "地圖內的不穩定裂痕會在穩定後生成一名額外稀有怪物"
      }
    ],
    [
      "explicit.stat_2017682521",
      {
        id: "explicit.stat_2017682521",
        en: "#% increased Pack Size in Map",
        zh_CN: "地图中的怪物群大小提高 #%",
        zh_TW: "增加#%地圖內的怪物群大小"
      }
    ],
    [
      "explicit.stat_4219853180",
      {
        id: "explicit.stat_4219853180",
        en: "Ritual Favours in Area have #% increased chance to be Omens",
        zh_CN: "区域内的驱灵祭坛恩典为预兆的几率提高 #%",
        zh_TW: "增加#%區域中祭祀恩惠含有徵兆的機率"
      }
    ]
  ]);
  hooks.storeTradeResultModifierDescriptions({
    result: [
      {
        id: "tablet-1",
        item: {
          explicitMods: [
            {
              hash: "stat.explicit.stat_2017682521",
              description: "7% increased Pack Size in Map"
            },
            {
              hash: "stat.explicit.stat_120737942",
              description: "[ContainsRitual|Ritual Altars] in Map allow rerolling Favours 3 additional times"
            },
            {
              hash: "stat.explicit.stat_4219853180",
              description: "[ContainsRitual|Ritual] Favours in Map have 60% increased chance to be [Omen|Omens]"
            },
            {
              hash: "stat.explicit.stat_3762913035",
              description: "Unstable [Breaches|Breaches] in Map spawn 2 additional [Rare] Monsters when Stabilised"
            }
          ],
          extended: {
            hashes: {
              explicit: [
                ["explicit.stat_2017682521", [1]],
                ["explicit.stat_120737942", [3]],
                ["explicit.stat_4219853180", [0]],
                ["explicit.stat_3762913035", [2]]
              ]
            }
          }
        }
      }
    ]
  });
  const elementFor = (statId) => ({
    closest(selector) {
      if (selector === "[data-field^='stat.']") {
        return { getAttribute: () => `stat.${statId}` };
      }
      if (selector === "[data-id]") {
        return { getAttribute: () => "tablet-1" };
      }
      return null;
    }
  });
  assert.deepStrictEqual(
    structuredClone({
      ritual: hooks.getTradeStatDisplay(
        "Ritual Altars in Area allow rerolling Favours an additional time",
        elementFor("explicit.stat_120737942")
      ),
      breach: hooks.getTradeStatDisplay(
        "Unstable Breaches in Map spawn an additional Rare Monster when Stabilised",
        elementFor("explicit.stat_3762913035")
      ),
      omens: hooks.getTradeStatDisplay(
        "Ritual Favours in Area have 60% increased chance to be Omens",
        elementFor("explicit.stat_4219853180")
      )
    }),
    {
      ritual: {
        primary: "區域中的祭祀神壇可以重骰恩賜之物額外3次",
        english: "Ritual Altars in Map allow rerolling Favours 3 additional times"
      },
      breach: {
        primary: "地圖內的不穩定裂痕會在穩定後生成2名額外稀有怪物",
        english: "Unstable Breaches in Map spawn 2 additional Rare Monsters when Stabilised"
      },
      omens: {
        primary: "增加60%區域中祭祀恩惠含有徵兆的機率",
        english: "Ritual Favours in Area have 60% increased chance to be Omens"
      }
    }
  );
});

test("Trade result localizes split Trial token popup properties", () => {
  class FakeElement {
    constructor(children = [], trialProperty = false) {
      this.nodeType = 1;
      this.childNodes = children;
      this.trialProperty = trialProperty;
    }

    matches(selector) {
      return this.trialProperty && selector === ".item-popup__property";
    }

    querySelectorAll() {
      const descendants = [];
      const visit = (element) => {
        for (const child of element.childNodes || []) {
          if (child.nodeType !== 1) continue;
          descendants.push(child);
          visit(child);
        }
      };
      visit(this);
      return descendants;
    }
  }
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { localizeTrialTokenProperty, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW", pageTranslationEnabled: true };
  hooks.runtime.tradeLocalization = {
    strings: {
      "Has Hare Foot": { en: "Has Hare Foot", zh_CN: "使用 野兔之足", zh_TW: "使用 腳兔" },
      "Has Worn Sandals": { en: "Has Worn Sandals", zh_CN: "使用 破烂凉鞋", zh_TW: "使用 磨損涼鞋" }
    }
  };
  const text = (nodeValue) => ({ nodeType: 3, nodeValue });
  const waterLabel = text("Sacred Water: ");
  const boonLabel = text("Minor Boons");
  const boonName = text("Hare Foot");
  const unknownBoonName = text("Unknown Boon");
  const afflictionLabel = text("Minor Afflictions");
  const afflictionName = text("Worn Sandals");
  const water = new FakeElement([
    new FakeElement([waterLabel, new FakeElement([text("626")])])
  ], true);
  const boons = new FakeElement([
    new FakeElement([
      new FakeElement([boonLabel]),
      text(": "),
      new FakeElement([boonName]),
      text(", "),
      new FakeElement([unknownBoonName])
    ])
  ], true);
  const afflictions = new FakeElement([
    new FakeElement([
      new FakeElement([afflictionLabel]),
      text(": "),
      new FakeElement([afflictionName])
    ])
  ], true);

  assert.equal(hooks.localizeTrialTokenProperty(water), true);
  assert.equal(hooks.localizeTrialTokenProperty(boons), true);
  assert.equal(hooks.localizeTrialTokenProperty(afflictions), true);
  assert.deepStrictEqual(
    structuredClone({
      water: waterLabel.nodeValue,
      boonLabel: boonLabel.nodeValue,
      boonName: boonName.nodeValue,
      unknownBoonName: unknownBoonName.nodeValue,
      afflictionLabel: afflictionLabel.nodeValue,
      afflictionName: afflictionName.nodeValue
    }),
    {
      water: "神聖之水: ",
      boonLabel: "次要恩惠",
      boonName: "腳兔",
      unknownBoonName: "Unknown Boon",
      afflictionLabel: "次要苦痛",
      afflictionName: "磨損涼鞋"
    }
  );

  hooks.runtime.state.pageLanguage = "en";
  hooks.localizeTrialTokenProperty(water);
  hooks.localizeTrialTokenProperty(boons);
  hooks.localizeTrialTokenProperty(afflictions);
  assert.deepStrictEqual(
    structuredClone({ water: waterLabel.nodeValue, boonLabel: boonLabel.nodeValue, boonName: boonName.nodeValue }),
    { water: "Sacred Water: ", boonLabel: "Minor Boons", boonName: "Hare Foot" }
  );
});

test("Trade stat render text remains stable after the bilingual result is inserted", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeStatRenderText };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const display = {
    primary: "+25 最大生命",
    english: "+25 to maximum Life"
  };
  assert.deepStrictEqual(
    structuredClone({
      result: sandbox.window.__testHooks.getTradeStatRenderText(display, true),
      filter: sandbox.window.__testHooks.getTradeStatRenderText(display, false)
    }),
    {
      result: "+25 最大生命 +25 to maximum Life",
      filter: "+25 最大生命 (+25 to maximum Life)"
    }
  );
});

test("Trade result refresh preserves the native stat HTML for translation rollback", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { localizeTradeStatElement, runtime };\n})();"
  );
  const createElement = () => ({ className: "", textContent: "" });
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: { createElement },
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_CN_en", pageTranslationEnabled: true };
  hooks.runtime.tradeStatsById = new Map([
    [
      "explicit.stat_life",
      {
        id: "explicit.stat_life",
        en: "+# to maximum Life",
        zh_CN: "+# 最大生命",
        zh_TW: "+# 最大生命"
      }
    ]
  ]);

  const nativeHtml = '<span class="value">+25 to maximum Life</span>';
  const element = {
    _children: [],
    _html: nativeHtml,
    _text: "+25 to maximum Life",
    get innerText() {
      return this._children.length ? this._children.map((child) => child.textContent).join(" ") : this._text;
    },
    get textContent() {
      return this.innerText;
    },
    get innerHTML() {
      return this._html;
    },
    set innerHTML(value) {
      this._children = [];
      this._html = value;
      this._text = value;
    },
    replaceChildren() {
      this._children = [];
      this._html = "";
      this._text = "";
    },
    appendChild(child) {
      this._children.push(child);
      this._html += child.textContent;
    },
    closest(selector) {
      if (selector === "[data-field^='stat.']") {
        return { getAttribute: () => "stat.explicit.stat_life" };
      }
      return selector.includes(".search-results") ? {} : null;
    }
  };

  hooks.localizeTradeStatElement(element);
  hooks.localizeTradeStatElement(element);
  hooks.runtime.state.pageTranslationEnabled = false;
  hooks.localizeTradeStatElement(element);

  assert.strictEqual(element.innerHTML, nativeHtml);
});

test("Trade result granted skills keep native keyword hover markup", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { localizeTradeStatElement, runtime };\n})();"
  );
  const createClassList = (el) => ({
    contains(name) {
      return String(el.className || "").split(/\s+/).includes(name);
    }
  });
  const createElement = (tag = "span") => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: "",
      textContent: "",
      classList: null,
      remove() {
        el._parent?.children && (el._parent.children = el._parent.children.filter((child) => child !== el));
      }
    };
    el.classList = createClassList(el);
    return el;
  };
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: { createElement },
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en", pageTranslationEnabled: true };
  hooks.runtime.tradeStatsById = new Map([
    [
      "skill.cast_on_elemental_ailment",
      {
        id: "skill.cast_on_elemental_ailment",
        en: "Grants Skill: Level # Cast on Elemental Ailment",
        zh_CN: "赋予技能: 等级 # 元素异常状态时施放",
        zh_TW: "賦予技能: 等級 # 元素異常狀態時施放"
      }
    ]
  ]);

  const icon = createElement("img");
  icon.className = "lci";
  const label = createElement("span");
  label.textContent = "Grants Skill";
  const keyword = createElement("span");
  keyword.className = "keyword";
  keyword.textContent = "Level 20 Cast on Elemental Ailment";
  let replaced = false;
  const element = {
    children: [icon, label, keyword],
    get innerText() {
      return this.children.map((child) => child.textContent).filter(Boolean).join(" ");
    },
    get textContent() {
      return this.innerText;
    },
    querySelector(selector) {
      const names = String(selector || "")
        .split(",")
        .map((part) => part.trim().replace(/^\./, ""));
      return this.children.find((child) => names.some((name) => createClassList(child).contains(name))) || null;
    },
    replaceChildren() {
      replaced = true;
      this.children = [];
    },
    appendChild(child) {
      child._parent = this;
      this.children.push(child);
    },
    closest(selector) {
      if (selector === "[data-field^='stat.']") {
        return { getAttribute: () => "stat.skill.cast_on_elemental_ailment" };
      }
      return selector.includes(".search-results") ? {} : null;
    }
  };

  hooks.localizeTradeStatElement(element);
  hooks.localizeTradeStatElement(element);

  assert.strictEqual(replaced, false);
  assert.strictEqual(keyword.className, "keyword");
  assert.strictEqual(label.textContent, "賦予技能");
  assert.strictEqual(keyword.textContent, "等級 20 元素異常狀態時施放");
  assert.strictEqual(
    element.querySelector(".poe2-marketwright-result-stat-original").textContent,
    "Grants Skill: Level 20 Cast on Elemental Ailment"
  );

  hooks.runtime.state.pageTranslationEnabled = false;
  hooks.localizeTradeStatElement(element);

  assert.strictEqual(replaced, false);
  assert.strictEqual(label.textContent, "Grants Skill");
  assert.strictEqual(keyword.textContent, "Level 20 Cast on Elemental Ailment");
  assert.equal(element.querySelector(".poe2-marketwright-result-stat-original"), null);
});

test("search results highlight queried affix text and keep desecrated chrome", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { collectSearchStatMatchKeys, resultStatFieldMatches, applyResultSearchStatHighlights };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  const query = {
    stats: [
      {
        type: "and",
        filters: [
          { id: "explicit.stat_124859000" },
          { id: "explicit.stat_264262054|3" },
          { id: "explicit.stat_3299347043", disabled: true }
        ]
      },
      {
        type: "not",
        filters: [{ id: "explicit.stat_3372524247" }]
      }
    ]
  };
  const wrappedKeys = hooks.collectSearchStatMatchKeys({ query, sort: { price: "asc" } });
  const keys = hooks.collectSearchStatMatchKeys(query);
  const createNode = (field, inResults = true) => {
    const classes = new Set();
    return {
      field,
      classList: {
        toggle(name, on) {
          if (on) classes.add(name);
          else classes.delete(name);
        },
        contains(name) {
          return classes.has(name);
        }
      },
      getAttribute() {
        return field;
      },
      closest(selector) {
        if (selector.includes("search-advanced") || selector.includes("search-bar")) {
          return null;
        }
        return inResults && /\.results|\.resultset|\.search-results/.test(selector) ? {} : null;
      }
    };
  };
  const evasion = createNode("stat.desecrated.stat_124859000");
  const unique = createNode("stat.explicit.stat_264262054|3");
  const otherUnique = createNode("stat.explicit.stat_264262054|11");
  const life = createNode("stat.explicit.stat_3299347043");
  const fire = createNode("stat.explicit.stat_3372524247");
  const formStat = createNode("stat.explicit.stat_124859000", false);
  const snapshot = (nodes) => Object.fromEntries(
    Object.entries(nodes).map(([name, node]) => [name, node.classList.contains("poe2-marketwright-result-stat-matched")])
  );
  const nodes = { evasion, unique, otherUnique, life, fire, formStat };
  const root = { querySelectorAll: () => Object.values(nodes) };
  hooks.applyResultSearchStatHighlights(root, query);
  const matched = snapshot(nodes);
  hooks.applyResultSearchStatHighlights(root, { stats: [] });
  assert.deepStrictEqual(
    structuredClone({
      keys,
      wrappedKeys,
      evasion: hooks.resultStatFieldMatches("stat.desecrated.stat_124859000", keys),
      unique: hooks.resultStatFieldMatches("stat.explicit.stat_264262054|3", keys),
      otherUnique: hooks.resultStatFieldMatches("stat.explicit.stat_264262054|11", keys),
      life: hooks.resultStatFieldMatches("stat.explicit.stat_3299347043", keys),
      fire: hooks.resultStatFieldMatches("stat.explicit.stat_3372524247", keys),
      matched,
      cleared: snapshot(nodes)
    }),
    {
      keys: [
        { bare: "stat_124859000", variant: "" },
        { bare: "stat_264262054", variant: "3" }
      ],
      wrappedKeys: [
        { bare: "stat_124859000", variant: "" },
        { bare: "stat_264262054", variant: "3" }
      ],
      evasion: true,
      unique: true,
      otherUnique: false,
      life: false,
      fire: false,
      matched: {
        evasion: true,
        unique: true,
        otherUnique: false,
        life: false,
        fire: false,
        formStat: false
      },
      cleared: {
        evasion: false,
        unique: false,
        otherUnique: false,
        life: false,
        fire: false,
        formStat: false
      }
    }
  );
});

test("trade localization preserves numeric stat values and English fallback", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLocalizedTradeText, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "zh_CN", pageLanguage: "zh_CN_en" };
  hooks.runtime.tradeLocalization = {
    strings: {
      "Item Category": { en: "Item Category", zh_CN: "物品类型", zh_TW: "物品類型" }
    }
  };
  hooks.runtime.tradeStatTemplates = new Map([
    [
      "# to maximum life",
      { en: "+# to maximum Life", zh_CN: "+# 生命上限", zh_TW: "+# 最大生命" }
    ]
  ]);
  const result = structuredClone({
    exact: hooks.getLocalizedTradeText("Item Category"),
    stat: hooks.getLocalizedTradeText("+60 to maximum Life"),
    unknown: hooks.getLocalizedTradeText("Player supplied note")
  });
  assert.deepStrictEqual(result, {
    exact: "物品类型",
    stat: "+60 生命上限 (+60 to maximum Life)",
    unknown: "Player supplied note"
  });
});

test("result whisper controls use compact localized labels without excluding their display text", () => {
  class FakeElement {
    closest(selector) {
      return selector.includes(".whisper-btn") ? this : null;
    }
  }
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLocalizedTradeText, isExcludedTradeLocalizationElement, runtime };\n})();"
  );
  const sandbox = {
    Element: FakeElement,
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW_en" };

  assert.deepStrictEqual(
    structuredClone({
      online: hooks.getLocalizedTradeText("Online"),
      whisper: hooks.getLocalizedTradeText("Direct Whisper"),
      excluded: hooks.isExcludedTradeLocalizationElement(new FakeElement())
    }),
    { online: "在線", whisper: "直接密語", excluded: false }
  );
});

test("Trade filter terminology overrides translate headings and help copy", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLocalizedTradeText, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW" };
  hooks.runtime.tradeLocalization = {
    strings: {
      "Type Filters": { en: "Type Filters", zh_CN: "类型过滤器", zh_TW: "類別過濾" }
    },
    optionStrings: {
      "Instant Buyout and In Person": {
        en: "Instant Buyout and In Person",
        zh_TW: "即刻購買以及面對面交易"
      },
      "Runes of Aldur": { en: "Runes of Aldur", zh_CN: "奥杜尔秘符", zh_TW: "阿德爾的符文" }
    }
  };
  const traditional = structuredClone({
    heading: hooks.getLocalizedTradeText("TYPE FILTERS"),
    equipment: hooks.getLocalizedTradeText("Equipment Filters"),
    stat: hooks.getLocalizedTradeText("Stat Filters"),
    weighted: hooks.getLocalizedTradeText("WEIGHTED SUM"),
    weightedV2: hooks.getLocalizedTradeText("WEIGHTED SUM V2"),
    runicWard: hooks.getLocalizedTradeText("Runic Ward"),
    equipmentTip: hooks.getLocalizedTradeText("Includes base value, local modifiers, and maximum quality"),
    rarityTip: hooks.getLocalizedTradeText("Increased Item Rarity"),
    selectedStatus: hooks.getLocalizedTradeText("Instant Buyout and In Person"),
    selectedLeague: hooks.getLocalizedTradeText("PoE2 - Runes of Aldur"),
    weightedTip: hooks.getLocalizedTradeText(
      "Each stat value that meets the `min` and `max` (if provided, otherwise existence) requirements will be multiplied by the `weight` before being summed together.\nUse the group's `min` and `max` to filter items based on the total summed value."
    )
  });
  hooks.runtime.state = { pageLanguage: "zh_CN" };
  const simplified = structuredClone({
    weighted: hooks.getLocalizedTradeText("WEIGHTED SUM"),
    addStatFilter: hooks.getLocalizedTradeText("+ Add Stat Filter"),
    addStatGroup: hooks.getLocalizedTradeText("+ Add Stat Group"),
    activateLiveSearch: hooks.getLocalizedTradeText("Activate Live Search"),
    search: hooks.getLocalizedTradeText("Search"),
    clear: hooks.getLocalizedTradeText("Clear"),
    hideFilters: hooks.getLocalizedTradeText("Hide Filters"),
    travelToHideout: hooks.getLocalizedTradeText("Travel to Hideout"),
    ignorePlayer: hooks.getLocalizedTradeText("Ignore Player")
  });
  hooks.runtime.state = { pageLanguage: "zh_TW" };
  const traditionalControls = structuredClone({
    addStatFilter: hooks.getLocalizedTradeText("+ Add Stat Filter"),
    addStatGroup: hooks.getLocalizedTradeText("+ Add Stat Group"),
    activateLiveSearch: hooks.getLocalizedTradeText("Activate Live Search"),
    search: hooks.getLocalizedTradeText("Search"),
    clear: hooks.getLocalizedTradeText("Clear"),
    hideFilters: hooks.getLocalizedTradeText("Hide Filters"),
    travelToHideout: hooks.getLocalizedTradeText("Travel to Hideout"),
    ignorePlayer: hooks.getLocalizedTradeText("Ignore Player")
  });
  assert.deepStrictEqual(traditional, {
    heading: "類別篩選器",
    equipment: "裝備篩選器",
    stat: "屬性篩選器",
    weighted: "加權總和",
    weightedV2: "加權總和 V2",
    runicWard: "符文保護",
    equipmentTip: "包含基礎數值、本地詞綴與最高品質",
    rarityTip: "增加物品稀有度",
    selectedStatus: "即刻購買以及面對面交易",
    selectedLeague: "PoE2 - 阿德爾的符文",
    weightedTip: "每個符合 `min` 與 `max`（若未設定，則檢查是否存在）條件的屬性數值，都會先乘以權重再加總。\n使用此群組的 `min` 與 `max`，依加權總和篩選物品。"
  });
  assert.deepStrictEqual(simplified, {
    weighted: "加权总和",
    addStatFilter: "+ 添加属性筛选器",
    addStatGroup: "+ 添加属性组",
    activateLiveSearch: "启用实时搜索",
    search: "搜索",
    clear: "清除",
    hideFilters: "隐藏筛选器",
    travelToHideout: "前往藏身处",
    ignorePlayer: "忽略玩家"
  });
  assert.deepStrictEqual(traditionalControls, {
    addStatFilter: "+ 新增屬性篩選器",
    addStatGroup: "+ 新增屬性群組",
    activateLiveSearch: "啟用即時搜尋",
    search: "搜尋",
    clear: "清除",
    hideFilters: "隱藏篩選器",
    travelToHideout: "前往藏身處",
    ignorePlayer: "忽略玩家"
  });
});

test("trade localization observes result roots without scanning search filters", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeResultLocalizationElements };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  let selector = "";
  sandbox.window.__testHooks.getTradeResultLocalizationElements({
    querySelectorAll(value) {
      selector = value;
      return [];
    },
    matches() {
      return false;
    }
  });
  assert.ok(selector.includes(".search-results"));
  assert.ok(selector.includes(".item-popup"));
  assert.ok(!selector.includes(".search-panel"));
  assert.ok(!selector.includes(".search-advanced-pane"));
  assert.ok(!selector.includes(".multiselect"));
});

test("trade localization reaches nested native labels but leaves excluded content alone", () => {
  class FakeElement {
    constructor(children = [], excluded = false) {
      this.nodeType = 1;
      this.childNodes = children;
      this.excluded = excluded;
    }

    hasAttribute() {
      return false;
    }

    closest() {
      return this.excluded ? this : null;
    }
  }
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { localizeTradeElement, runtime };\n})();"
  );
  const sandbox = {
    Element: FakeElement,
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "en", pageLanguage: "zh_CN" };
  hooks.runtime.tradeLocalization = {
    strings: {
      "Item Category": { en: "Item Category", zh_CN: "物品类型", zh_TW: "物品類型" },
      "Rider Bow": { en: "Rider Bow", zh_CN: "骑射之弓", zh_TW: "騎士之弓" }
    }
  };
  const label = { nodeType: 3, nodeValue: "Item Category" };
  const protectedText = { nodeType: 3, nodeValue: "Item Category" };
  const reusableText = { nodeType: 3, nodeValue: "Item Category" };
  const reusableLabel = new FakeElement([reusableText]);
  hooks.localizeTradeElement(new FakeElement([new FakeElement([label]), reusableLabel, new FakeElement([protectedText], true)]));
  reusableText.nodeValue = "Rider Bow";
  hooks.localizeTradeElement(reusableLabel);
  assert.deepStrictEqual(structuredClone({ label: label.nodeValue, reusable: reusableText.nodeValue, protected: protectedText.nodeValue }), {
    label: "物品类型",
    reusable: "骑射之弓",
    protected: "Item Category"
  });
  hooks.runtime.state.pageTranslationEnabled = false;
  hooks.localizeTradeElement(new FakeElement([new FakeElement([label]), reusableLabel]));
  assert.deepStrictEqual(structuredClone({ label: label.nodeValue, reusable: reusableText.nodeValue }), {
    label: "Item Category",
    reusable: "Rider Bow"
  });
});

test("gem item tooltips localize stable property labels and generated level details", () => {
  class FakeElement {
    closest(selector) {
      return selector === ".item-popup--gem" ? this : null;
    }
  }
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLocalizedTradeText, runtime };\n})();"
  );
  const sandbox = {
    Element: FakeElement,
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW" };
  hooks.runtime.tradeLocalization = {
    strings: {
      Buff: { en: "Buff", zh_TW: "增益效果" },
      Persistent: { en: "Persistent", zh_TW: "持續" },
      Quality: { en: "Quality", zh_TW: "品質" },
      Reservation: { en: "Reservation", zh_TW: "保留" },
      Requires: { en: "Requires", zh_TW: "需求" },
      Spirit: { en: "Spirit", zh_TW: "精魂" }
    }
  };
  const gemPopup = new FakeElement();

  assert.deepStrictEqual(
    [
      hooks.getLocalizedTradeText("Buff", gemPopup),
      hooks.getLocalizedTradeText("Persistent", gemPopup),
      hooks.getLocalizedTradeText("Buff, Persistent", gemPopup),
      hooks.getLocalizedTradeText("Quality: ", gemPopup),
      hooks.getLocalizedTradeText("Reservation: ", gemPopup),
      hooks.getLocalizedTradeText("30 Spirit", gemPopup),
      hooks.getLocalizedTradeText("Requires ", gemPopup),
      hooks.getLocalizedTradeText("20 Levels from Gem (Max)", gemPopup),
      hooks.getLocalizedTradeText("+1 Level from Corruption", gemPopup)
    ],
    ["增益效果", "持續", "增益效果, 持續", "品質: ", "保留: ", "30 精魂", "需求 ", "透過寶石 20 等（最高）", "腐化等級 +1"]
  );

  hooks.runtime.state.pageLanguage = "zh_CN";
  hooks.runtime.tradeLocalization.strings = {
    Buff: { en: "Buff", zh_CN: "增益" },
    Persistent: { en: "Persistent", zh_CN: "永久性" },
    Quality: { en: "Quality", zh_CN: "品质" },
    Reservation: { en: "Reservation", zh_CN: "保留" },
    Requires: { en: "Requires", zh_CN: "需求" },
    Spirit: { en: "Spirit", zh_CN: "精魂" }
  };
  assert.deepStrictEqual(
    [
      hooks.getLocalizedTradeText("Buff", gemPopup),
      hooks.getLocalizedTradeText("Persistent", gemPopup),
      hooks.getLocalizedTradeText("Buff, Persistent", gemPopup),
      hooks.getLocalizedTradeText("Quality: ", gemPopup),
      hooks.getLocalizedTradeText("Reservation: ", gemPopup),
      hooks.getLocalizedTradeText("30 Spirit", gemPopup),
      hooks.getLocalizedTradeText("Requires ", gemPopup),
      hooks.getLocalizedTradeText("20 Levels from Gem (Max)", gemPopup),
      hooks.getLocalizedTradeText("+1 Level from Corruption", gemPopup)
    ],
    ["增益", "永久性", "增益, 永久性", "品质: ", "保留: ", "30 精魂", "需求 ", "通过宝石 20 等（最高）", "腐化等级 +1"]
  );
});

test("favorite presentation uses the global language without overwriting custom names", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoritePresentation, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "zh_CN" };
  hooks.runtime.messages = { selectionPage_Bows: { message: "弓" } };
  hooks.runtime.data = {
    itemNameToSelection: { "rider bow": { kind: "page", id: "Bows" } },
    displayMetadata: {
      items: { "Rider Bow": { en: "Rider Bow", zh_CN: "骑射之弓", zh_TW: "騎士之弓" } },
      stats: {
        "explicit.stat_life": { en: "+# to maximum Life", zh_CN: "+# 生命上限", zh_TW: "+# 最大生命" }
      }
    }
  };
  const automatic = hooks.getFavoritePresentation({
    nameSource: "automatic",
    displayName: "Storm Ward",
    originalName: "Storm Ward",
    baseName: "Rider Bow",
    itemType: "Bow",
    rarity: "rare",
    mods: [{ id: "explicit.stat_life", text: "+60 to maximum Life", source: "explicit" }]
  });
  const custom = hooks.getFavoritePresentation({
    nameSource: "custom",
    displayName: "My saved bow",
    baseName: "Rider Bow",
    itemType: "Bow",
    rarity: "rare",
    mods: []
  });
  const result = structuredClone({ automatic, custom });
  assert.deepStrictEqual(result["automatic"]["displayName"], "Storm Ward");
  assert.deepStrictEqual(result["automatic"]["baseName"], "骑射之弓");
  assert.deepStrictEqual(result["automatic"]["itemType"], "弓");
  assert.deepStrictEqual(result["automatic"]["rarity"], "稀有");
  assert.deepStrictEqual(result["automatic"]["mods"][0]["text"], "+60 生命上限");
  assert.ok((result["automatic"]["searchTerms"]).includes("+60 to maximum Life"));
  assert.deepStrictEqual(result["custom"]["displayName"], "My saved bow");
});

test("unique favorite presentation localizes unique name plus base", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoritePresentation, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "zh_CN" };
  hooks.runtime.data = {
    displayMetadata: {
      items: { Diamond: { en: "Diamond", zh_CN: "宝钻", zh_TW: "鑽石" } }
    },
    tradeLocalization: {
      search: {
        items: [{
          id: "Megalomaniac Diamond",
          en: "Megalomaniac Diamond",
          zh_CN: "妄想症 宝钻",
          zh_TW: "妄想症 鑽石"
        }]
      }
    }
  };
  const unique = hooks.getFavoritePresentation({
    nameSource: "automatic",
    displayName: "Megalomaniac",
    originalName: "Megalomaniac",
    baseName: "Diamond",
    rarity: "unique",
    mods: []
  });
  const combined = hooks.getFavoritePresentation({
    nameSource: "automatic",
    displayName: "Megalomaniac Diamond",
    originalName: "Megalomaniac",
    baseName: "Diamond",
    rarity: "unique",
    mods: []
  });
  assert.equal(unique.displayName, "妄想症 宝钻");
  assert.equal(combined.displayName, "妄想症 宝钻");
  assert.equal(unique.baseName, "宝钻");
});

test("currency panel displays the detected league", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { updateCurrencyLeague, runtime };\n})();"
  );

  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const leagueNode = { textContent: "", title: "", dataset: {} };
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.ui.currencyLeague = leagueNode;
  hooks.updateCurrencyLeague(
    "HC Runes of Aldur",
    "https://www.pathofexile.com/trade2/search/HC%20Runes%20of%20Aldur/query-1"
  );
  const result = structuredClone(leagueNode);
  assert.deepStrictEqual(result, {"textContent": "League: HC Runes of Aldur", "title": "https://www.pathofexile.com/trade2/search/HC%20Runes%20of%20Aldur/query-1", "dataset": {"state": "ready"}});
});

test("collapsed panel preserves vertical position while ignoring legacy horizontal coordinates", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { applyPanelPosition, runtime };\n})();"
  );

  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const root = {
    style: {},
    getBoundingClientRect() {
      return { left: 240, top: 180, width: 36, height: 36 };
    }
  };
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.ui.root = root;
  hooks.runtime.state = {
    collapsed: true,
    panelPosition: { top: 180 },
    collapsedPosition: { top: 300 }
  };
  hooks.applyPanelPosition();
  const collapsedStyle = { ...root.style };

  hooks.runtime.state.collapsed = false;
  hooks.applyPanelPosition();

  const result = structuredClone({ collapsedStyle, expandedStyle: root.style });
  assert.deepStrictEqual(result, {"collapsedStyle": {"left": "", "top": "300px", "right": ""}, "expandedStyle": {"left": "", "top": "180px", "right": ""}});
});

test("expanding from the collapsed mark keeps the saved vertical position", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setPanelCollapsed, runtime };\n})();"
  );

  const sandbox = {
    window: {
      addEventListener() {},
      clearTimeout() {},
      setTimeout() { return 1; },
      innerWidth: 1280,
      innerHeight: 900
    },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const hooks = sandbox.window.__testHooks;
  const classes = new Set();
  const root = {
    style: { left: "600px", top: "200px", right: "auto" },
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    getBoundingClientRect() {
      const left = Number.parseFloat(this.style.left || "600");
      const top = Number.parseFloat(this.style.top || "200");
      return {
        left,
        top,
        width: hooks.runtime.state.collapsed ? 36 : 238,
        height: hooks.runtime.state.collapsed ? 36 : 188
      };
    }
  };
  const collapse = {
    setAttribute() {},
    getBoundingClientRect() {
      const rect = root.getBoundingClientRect();
      return { left: rect.left + 200, top: rect.top + 8, width: 22, height: 20 };
    }
  };
  const expand = {
    setAttribute() {},
    getBoundingClientRect() {
      const rect = root.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: 36, height: 36 };
    }
  };
  hooks.runtime.ui = { root, collapse, expand };
  hooks.runtime.state = {
    collapsed: true,
    panelPosition: { top: 200 },
    collapsedPosition: { top: 200 }
  };

  await hooks.setPanelCollapsed(false);
  const result = structuredClone({ panelPosition: hooks.runtime.state.panelPosition, style: root.style });
  assert.deepStrictEqual(result, {"panelPosition": {"top": 200}, "style": {"left": "", "top": "200px", "right": ""}});
});

test("export link favorites copies compatible json to the clipboard", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { exportLinkFavorites, runtime };\n})();"
  );
  const writes = [];
  const sandbox = {
    window: {
      addEventListener() {},
      clearTimeout() {},
      setTimeout() { return 1; },
      innerWidth: 1280,
      innerHeight: 900,
      location: {
        href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-current"
      }
    },
    document: {
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    location: {
      pathname: "/trade2",
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-current"
    },
    navigator: {
      clipboard: {
        async writeText(text) { writes.push(JSON.parse(text)); }
      }
    },
    URL,
    console,
    chrome: {}
  };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = {
    linkFavorites: {
      version: 2,
      leagues: {
        Dawn: {
          folders: [{ id: "folder-1", name: "Bows", createdAt: 1, collapsed: false }],
          folderOrder: ["folder-1"],
          links: [{
            id: "link-1",
            url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
            displayName: "Bow",
            folderId: "folder-1",
            createdAt: 2
          }],
          rootLinkIds: [],
          folderLinkIds: { "folder-1": ["link-1"] }
        }
      }
    }
  };
  await hooks.exportLinkFavorites();
  const result = structuredClone({ writes, feedback: hooks.runtime.linkFavoriteFeedback });
  assert.deepStrictEqual(result, {"writes": [{"folders": [{"id": "folder-1", "childIds": [], "parentId": null, "depth": 0, "index": 0, "name": "Bows", "bookmarks": [{"id": "link-1", "name": "Bow", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-1", "type": "search", "idx": 0, "isDone": true}], "isOpen": true}], "rootBookmarks": []}], "feedback": {"key": "linkFavoriteExported", "text": "Bookmarks copied to clipboard", "state": "ready"}});
});
