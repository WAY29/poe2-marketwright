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
    tierEnabled: true,
    tierMode: "minimum",
    tierPageLabels: { Rings: "Rings" },
    tierLabel: "Tier"
  });
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

test("trade localization queries semantic descendants relative to the trade root", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeLocalizationElements };\n})();"
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
  sandbox.window.__testHooks.getTradeLocalizationElements({
    querySelectorAll(value) {
      selector = value;
      return [];
    },
    matches() {
      return false;
    }
  });
  assert.ok(selector.includes(".search-panel"));
  assert.ok(selector.includes(".controls"));
  assert.ok(!selector.includes("#trade"));
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

test("advanced Trade filter labels can be localized without touching search controls", () => {
  class FakeElement {
    constructor(children = [], advanced = false) {
      this.nodeType = 1;
      this.childNodes = children;
      this.advanced = advanced;
    }

    hasAttribute() {
      return false;
    }

    closest(selector) {
      return this.advanced && selector === "#trade .search-advanced-pane" ? this : null;
    }

    matches() {
      return false;
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
  hooks.runtime.state = { pageLanguage: "zh_TW" };
  hooks.runtime.tradeLocalization = { strings: {} };
  const label = { nodeType: 3, nodeValue: "WEIGHTED SUM" };
  const advancedLabel = new FakeElement([label], true);
  hooks.localizeTradeElement(advancedLabel);
  assert.equal(label.nodeValue, "WEIGHTED SUM");
  hooks.localizeTradeElement(advancedLabel, { allowAdvancedFilterCopy: true });
  assert.equal(label.nodeValue, "加權總和");
});

test("Trade filter tips preserve line breaks while translating complete help copy", () => {
  class FakeElement {
    constructor(children = [], nodeName = "DIV") {
      this.nodeType = 1;
      this.childNodes = children;
      this.nodeName = nodeName;
    }

    get textContent() {
      return this.childNodes
        .map((child) => child.nodeType === 3 ? child.nodeValue : child.textContent)
        .join("");
    }

    replaceChildren(...children) {
      this.childNodes = children;
    }

    querySelectorAll() {
      return this.tips || [];
    }
  }
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getTradeFilterTipText, localizeTradeFilterTipCopy, runtime };\n})();"
  );
  const weightedTip = new FakeElement([
    { nodeType: 3, nodeValue: "Check each stat meets the `min` and `max` (if provided, otherwise existence) requirements before multiplying the stat value by the `weight` and finally summing them together." },
    new FakeElement([], "BR"),
    { nodeType: 3, nodeValue: "Use the group's `min` and `max` to filter items based on the total summed value." }
  ], "P");
  const weightedV2Tip = new FakeElement([
    { nodeType: 3, nodeValue: "Each stat value that meets the `min` and `max` (if provided, otherwise existence) requirements will be multiplied by the `weight` before being summed together." },
    new FakeElement([], "BR"),
    { nodeType: 3, nodeValue: "Use the group's `min` and `max` to filter items based on the total summed value." }
  ], "P");
  const crucibleTip = new FakeElement([
    { nodeType: 3, nodeValue: "Filter by the mods that you want to be able to allocate at once." },
    new FakeElement([], "BR"),
    { nodeType: 3, nodeValue: "Use a lower `min` value for partial matches." }
  ], "P");
  const root = new FakeElement();
  root.tips = [weightedTip, weightedV2Tip, crucibleTip];
  const sandbox = {
    Element: FakeElement,
    window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
    document: {
      createElement(nodeName) { return new FakeElement([], nodeName.toUpperCase()); },
      createTextNode(nodeValue) { return { nodeType: 3, nodeValue }; }
    },
    location: { pathname: "/trade2" },
    console,
    chrome: {}
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { pageLanguage: "zh_TW" };
  hooks.runtime.tradeLocalization = { strings: {} };
  hooks.localizeTradeFilterTipCopy(root);
  assert.equal(
    hooks.getTradeFilterTipText(weightedTip),
    "每個符合 `min` 與 `max`（若未設定，則檢查是否存在）條件的屬性數值，都會先乘以權重再加總。\n使用此群組的 `min` 與 `max`，依加權總和篩選物品。"
  );
  assert.equal(
    hooks.getTradeFilterTipText(weightedV2Tip),
    "每個符合 `min` 與 `max`（若未設定，則檢查是否存在）條件的屬性數值，都會先乘以權重再加總。\n使用此群組的 `min` 與 `max`，依加權總和篩選物品。"
  );
  assert.equal(
    hooks.getTradeFilterTipText(crucibleTip),
    "篩選你希望能同時配置的詞綴。\n使用較低的 `min` 值以配對部分結果。"
  );
  assert.equal(weightedTip.childNodes[1].nodeName, "BR");
  assert.equal(weightedV2Tip.childNodes[1].nodeName, "BR");
  assert.equal(crucibleTip.childNodes[1].nodeName, "BR");

  hooks.runtime.state.pageLanguage = "en";
  hooks.localizeTradeFilterTipCopy(root);
  assert.equal(
    hooks.getTradeFilterTipText(weightedV2Tip),
    "Each stat value that meets the `min` and `max` (if provided, otherwise existence) requirements will be multiplied by the `weight` before being summed together.\nUse the group's `min` and `max` to filter items based on the total summed value."
  );
  assert.equal(weightedV2Tip.childNodes[1].nodeName, "BR");
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
