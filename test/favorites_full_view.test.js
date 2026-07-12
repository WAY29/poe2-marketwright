"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("full view defaults to compact and migrates the open item drawer", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { loadState, setFavoritesViewMode, runtime };\n})();"
  );
  const classList = { toggle() {} };
  const createViewModeButton = () => ({
    attributes: {},
    title: "",
    innerHTML: "",
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const itemViewMode = createViewModeButton();
  const linkViewMode = createViewModeButton();
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1440, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2" },
    console,
    chrome: {
      storage: {
        local: {
          get: async () => ({ poe2Trade2AffixFilterState: { favoritesDrawerOpen: true } }),
          set: async () => {}
        }
      }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = await hooks.loadState();
  hooks.runtime.ui = {
    root: { classList },
    favoritesDisclosure: { setAttribute() {} },
    linkFavoritesDisclosure: { setAttribute() {} },
    favoritesViewMode: itemViewMode,
    favoritesViewModes: [itemViewMode, linkViewMode]
  };
  await hooks.setFavoritesViewMode("full");
  const full = { ...hooks.runtime.state };
  const fullModeIcon = itemViewMode.innerHTML;
  await hooks.setFavoritesViewMode("compact");
  const result = structuredClone({
    defaultsToCompact: full.favoritesViewMode === "full",
    fullPanelOpen: full.favoritesPanelOpen,
    fullPanelTab: full.favoritesPanelTab,
    drawersClosed: !full.favoritesDrawerOpen && !full.linkFavoritesDrawerOpen,
    compactDrawerRestored: hooks.runtime.state.favoritesDrawerOpen,
    compactPanelClosed: !hooks.runtime.state.favoritesPanelOpen,
    fullModeButtonsSynced:
      itemViewMode.title === "Use full favorites view" &&
      linkViewMode.title === "Use full favorites view" &&
      itemViewMode.innerHTML !== fullModeIcon
  });
  assert.deepStrictEqual(result, {"defaultsToCompact": true, "fullPanelOpen": true, "fullPanelTab": "items", "drawersClosed": true, "compactDrawerRestored": true, "compactPanelClosed": true, "fullModeButtonsSynced": true});
});

test("background relays panel requests only to the registered trade tab", async () => {
  let messageListener;
  const tabMessages = [];
  const sessionValues = new Map();
  const sandbox = {
    chrome: {
      runtime: {
        id: "extension-id",
        onMessage: { addListener(listener) { messageListener = listener; } }
      },
      storage: {
        session: {
          async get(key) { return { [key]: sessionValues.get(key) }; },
          async set(values) { for (const [key, value] of Object.entries(values)) sessionValues.set(key, value); }
        }
      },
      tabs: {
        async sendMessage(tabId, message) {
          tabMessages.push({ tabId, message });
          return { ok: true, state: { favoritesViewMode: "full" } };
        }
      }
    },
    fetch() { throw new Error("unexpected fetch"); },
    console
  };
  vm.runInNewContext(fs.readFileSync("background.js", "utf8"), sandbox, { filename: "background.js" });
  const send = (message, sender) => new Promise((resolve) => messageListener(message, sender, resolve));
  const registration = await send(
    { type: "favorites-panel-register", sessionId: "panel-session-1" },
    { id: "extension-id", tab: { id: 37 } }
  );
  const relayed = await send(
    { type: "favorites-panel-request", sessionId: "panel-session-1", command: "get-state" },
    { id: "extension-id" }
  );
  const rejected = await send(
    { type: "favorites-panel-request", sessionId: "unknown-session", command: "get-state" },
    { id: "extension-id" }
  );
  const result = structuredClone({ registration, relayed, rejected, tabMessages });
  assert.deepStrictEqual(result["registration"], {"ok": true});
  assert.deepStrictEqual(result["relayed"], {"ok": true, "state": {"favoritesViewMode": "full"}});
  assert.deepStrictEqual(result["rejected"], {"ok": false, "error": "unknown_panel_session"});
  assert.deepStrictEqual(result["tabMessages"], [{"tabId": 37, "message": {"type": "favorites-panel-command", "sessionId": "panel-session-1", "command": "get-state", "payload": undefined}}]);
});

test("full view toggles only the current document panel", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setFavoritesViewMode, setFavoritesPanelOpen, runtime };\n})();"
  );
  const panelFrame = {
    hidden: true,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  const documentClasses = new Set();
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1440, innerHeight: 900 },
    document: {
      documentElement: {
        classList: {
          toggle(name, enabled) {
            if (enabled) documentClasses.add(name);
            else documentClasses.delete(name);
          }
        }
      }
    },
    location: { pathname: "/trade2", href: "https://www.pathofexile.com/trade2/search/poe2/Runes/query-1" },
    console,
    chrome: {
      storage: { local: { set: async () => {} } }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = {
    favoritesViewMode: "compact",
    favoritesPanelOpen: false,
    favoritesPanelTab: "items",
    favorites: [],
    linkFavorites: { leagues: {} },
    favoritesEnabled: true,
    linkFavoritesEnabled: true
  };
  hooks.runtime.ui = {
    root: { classList: { toggle() {} } },
    favoritesPanelFrame: panelFrame
  };
  await hooks.setFavoritesViewMode("full");
  const hiddenAfterModeChange = panelFrame.hidden;
  await hooks.setFavoritesPanelOpen(true, "items");
  const visibleAfterOpen = !panelFrame.hidden && panelFrame.attributes["aria-hidden"] === "false";
  const documentLayoutUnchanged = !documentClasses.has("poe2-marketwright-favorites-full-view-open");
  await hooks.setFavoritesPanelOpen(false, "items");
  const result = structuredClone({ hiddenAfterModeChange, visibleAfterOpen, documentLayoutUnchanged, hiddenAfterClose: panelFrame.hidden });
  assert.deepStrictEqual(result, {"hiddenAfterModeChange": true, "visibleAfterOpen": true, "documentLayoutUnchanged": true, "hiddenAfterClose": true});
});

test("clicking the open full view section closes the side panel", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { toggleFavoritesView, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {}, innerWidth: 1440, innerHeight: 900 },
    document: {},
    location: { pathname: "/trade2", href: "https://www.pathofexile.com/trade2/search/poe2/Runes/query-1" },
    console,
    chrome: {
      storage: { local: { set: async () => {} } }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = {
    favoritesViewMode: "full",
    favoritesPanelOpen: true,
    favoritesPanelTab: "items",
    favorites: [],
    linkFavorites: { leagues: {} },
    favoritesEnabled: true,
    linkFavoritesEnabled: true
  };
  await hooks.toggleFavoritesView("items");
  const result = structuredClone({ state: hooks.runtime.state });
  assert.equal(result["state"]["favoritesPanelOpen"], false);
});

test("saving a link captures active advanced filter groups", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCurrentLinkFavoriteFilterGroups };\n})();"
  );
  const label = (textContent, directText = "") => ({
    textContent,
    childNodes: directText ? [{ nodeType: 3, nodeValue: directText }] : []
  });
  const nestedLabel = (textContent) => ({
    textContent,
    childNodes: [{ nodeType: 3, nodeValue: " " }]
  });
  const select = (textContent) => ({ selectedOptions: [{ textContent }], value: textContent });
  const input = (value, placeholder) => ({
    type: "number",
    value,
    placeholder,
    closest() { return null; },
    getAttribute() { return null; }
  });
  const checkbox = () => ({
    type: "checkbox",
    value: "",
    checked: true,
    closest() { return null; },
    getAttribute() { return null; }
  });
  const field = (name, selects = [], inputs = [], labelNode = label(name)) => ({
    matches(selector) { return selector === ".filter, .filter-property"; },
    querySelector(selector) { return selector === ".filter-title" ? labelNode : null; },
    querySelectorAll(selector) {
      if (selector === ".multiselect") return [];
      if (selector === "select") return selects;
      if (selector === "input") return inputs;
      return [];
    }
  });
  const group = (name, fields) => {
    const body = {
      children: fields,
      querySelectorAll() { return []; }
    };
    return {
      querySelector(selector) {
        if (selector === ".filter-group-body") return body;
        return label(name);
      }
    };
  };
  const leftGroups = [
    group("Type Filters", [field("Item Category", [select("Bow")])]),
    group("Item Requirements", [field("Item Level", [], [input("80", "Min"), input("100", "Max")])]),
    group("Equipment Filters", [
      field("Corrupted", [], [checkbox()]),
      field("閃避 Includes base value, local modifiers, and maximum quality", [], [{
        type: "number",
        value: "700",
        placeholder: "Min",
        closest() { return null; },
        getAttribute(name) { return name === "aria-label" ? "Includes base value, local modifiers, and maximum quality" : null; }
      }, {
        type: "number",
        value: "900",
        placeholder: "Max",
        closest() { return null; },
        getAttribute(name) { return name === "aria-label" ? "Includes base value, local modifiers, and maximum quality" : null; }
      }], label("閃避 Includes base value, local modifiers, and maximum quality", "閃避")),
      field("Armour", [], [{
        type: "number",
        value: "500",
        placeholder: "Max",
        closest() { return null; },
        getAttribute(name) { return name === "aria-label" ? "Includes base value, local modifiers, and maximum quality" : null; }
      }]),
      field("Runic Ward Includes base value, local modifiers, and maximum quality", [], [{
        type: "number",
        value: "100",
        placeholder: "Min",
        closest() { return null; },
        getAttribute(name) { return name === "aria-label" ? "Includes base value, local modifiers, and maximum quality" : null; }
      }], label("Runic Ward Includes base value, local modifiers, and maximum quality", "Runic Ward"))
    ]),
    group("Trade Filters", [field("Indexed", [select("Yes")])])
  ];
  const rightGroups = [
    group("Stat Filters", [
      field("+# to maximum Life", [], [input("50", "Min")], nestedLabel("+# to maximum Life")),
      field("+#% increased Movement Speed", [], [input("21", "Min")], nestedLabel("+#% increased Movement Speed"))
    ]),
    group("Weighted Sum Check each stat meets its minimum.", [
      field("explicit +# to maximum Life", [], [input("50", "Min")])
    ])
  ];
  const sandbox = {
    window: { addEventListener() {} },
    document: {
      querySelectorAll(selector) {
        return selector === "#trade .search-advanced-pane.blue > .filter-group"
          ? leftGroups
          : leftGroups.concat(rightGroups);
      }
    },
    location: { pathname: "/trade2", href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1" },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return { normalizeLinkFavoriteFilterGroups: (value) => value };
      }
    },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const result = structuredClone(sandbox.window.__testHooks.getCurrentLinkFavoriteFilterGroups());
  assert.deepStrictEqual(result, [{"label": "Type Filters", "values": ["Item Category: Bow"]}, {"label": "Item Requirements", "values": ["Item Level: 80 - 100"]}, {"label": "Equipment Filters", "values": ["Corrupted", "閃避: 700 - 900", "Armour: - 500", "Runic Ward: 100 -"]}]);
});

test("link snapshots preserve every official stat group and relationship", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { buildLinkFavoriteDisplaySnapshot };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const result = structuredClone(sandbox.window.__testHooks.buildLinkFavoriteDisplaySnapshot({
    query: {
      stats: [
        { type: "and", filters: [{ id: "explicit.stat_life", value: { min: 50 }, disabled: true }] },
        { type: "or", filters: [{ id: "explicit.stat_fire_resistance", value: { min: 30 } }] },
        { type: "count", value: { min: 2 }, filters: [{ id: "explicit.stat_cold_resistance", value: { min: 30 } }] },
        { type: "weight2", value: { min: 120 }, filters: [{ id: "explicit.stat_movement_speed", value: { min: 20, weight: 2 } }] }
      ]
    }
  }));
  assert.deepStrictEqual(result, {"statGroups": [{"type": "and", "filters": [{"id": "explicit.stat_life", "value": {"min": 50}, "disabled": true}]}, {"type": "or", "filters": [{"id": "explicit.stat_fire_resistance", "value": {"min": 30}}]}, {"type": "count", "value": {"min": 2}, "filters": [{"id": "explicit.stat_cold_resistance", "value": {"min": 30}}]}, {"type": "weighted", "value": {"min": 120}, "filters": [{"id": "explicit.stat_movement_speed", "value": {"min": 20}, "weight": 2}]}], "statGroupsVersion": 3});

  const favoritesSandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), favoritesSandbox, { filename: "favorites.js" });
  const record = favoritesSandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools().createLinkFavoriteRecord({
    url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
    displayName: "Weighted search",
    displaySnapshot: result
  });
  assert.equal(record.displaySnapshot.statGroups[3].filters[0].weight, 2);
});

test("link tooltip groups include every saved filter", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLinkFavoriteTooltipGroups };\n})();"
  );
  const sandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return { formatLinkFavoriteStatFilter(value) { return { text: `formatted ${value}`, source: null }; } };
      }
    },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const result = structuredClone(sandbox.window.__testHooks.getLinkFavoriteTooltipGroups({
    url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
    filterGroups: [
      { label: "Type Filters", values: ["Item Category: Ring"] },
      { label: "Other", values: ["Fractured: Yes"] },
      { label: "Stat Filters", values: ["+# to maximum Life", "+#% Fire Resistance"] }
    ]
  }));
  assert.deepStrictEqual(result, [{"label": "Type Filters", "values": [{"text": "Item Category: Ring", "source": null}]}, {"label": "Other", "values": [{"text": "Fractured: Yes", "source": null}]}, {"label": "Stat Filters", "values": [{"text": "formatted +# to maximum Life", "source": null}, {"text": "formatted +#% Fire Resistance", "source": null}]}]);
  assert.ok((fs.readFileSync("favorites-panel.html", "utf8")).includes("id=\"favorites-panel-tooltip\""));
});

test("link tooltip renders every structured stat group with its relationship", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLinkFavoriteTooltipGroups };\n})();"
  );
  const sandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const result = structuredClone(sandbox.window.__testHooks.getLinkFavoriteTooltipGroups({
    localizedSnapshot: {
      stats: [
        { text: "+50 to maximum Life", source: null },
        { text: "+30% to Fire Resistance", source: null },
        { text: "+30% to Cold Resistance", source: null },
        { text: "20% increased Movement Speed", source: null }
      ],
      statGroups: [
        { type: "and", filters: [{ text: "+50 to maximum Life", source: null, disabled: true }] },
        { type: "or", filters: [{ text: "+30% to Fire Resistance", source: null }] },
        { type: "count", value: { min: 2 }, filters: [{ text: "+30% to Cold Resistance", source: null }] },
        { type: "weighted", value: { min: 120, max: 200 }, filters: [{ text: "20% increased Movement Speed", source: null, weight: 2 }] },
        { type: "not", value: { max: 3 }, filters: [{ text: "+20 to maximum Mana", source: null }] }
      ]
    },
    filterGroups: [
      { label: "Stat Filters", values: ["legacy filter"] },
      { label: "Other", values: ["Corrupted: No"] }
    ]
  }));
  assert.deepStrictEqual(result, [{"label": "Other", "values": [{"text": "Corrupted: No", "source": null}]}, {"label": "Stat Filters: AND", "values": [{"text": "+50 to maximum Life", "source": null, "disabled": true}]}, {"label": "Stat Filters: OR", "values": [{"text": "+30% to Fire Resistance", "source": null}]}, {"label": "Stat Filters: COUNT (2 -)", "values": [{"text": "+30% to Cold Resistance", "source": null}]}, {"label": "Stat Filters: WEIGHTED SUM (120 - 200)", "values": [{"text": "20% increased Movement Speed", "source": null, "weight": 2}]}, {"label": "Stat Filters: NOT (- 3)", "values": [{"text": "+20 to maximum Mana", "source": null}]}]);
});

test("link tooltip prefers above the pointer and flips below at the top edge", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLinkFavoriteTooltipPosition };\n})();"
  );
  const sandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const position = sandbox.window.__testHooks.getLinkFavoriteTooltipPosition;
  const result = structuredClone({
    above: position({ x: 160, y: 500 }, { width: 300, height: 180 }, { width: 360, height: 800 }),
    below: position({ x: 160, y: 50 }, { width: 300, height: 180 }, { width: 360, height: 800 })
  });
  assert.deepStrictEqual(result, {"above": {"left": 10, "top": 308, "placement": "above", "arrowX": 150}, "below": {"left": 10, "top": 62, "placement": "below", "arrowX": 150}});
});

test("compact link favorite uses the same stat summary and tooltip groups", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCompactLinkFavoritePresentation };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          formatLinkFavoriteStatFilter(value) {
            return value.startsWith("FRACTURED")
              ? { text: "+18% to Item Rarity", source: { key: "fractured", label: "FRACTURED" } }
              : { text: `formatted ${value}`, source: null };
          }
        };
      }
    },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const result = structuredClone(sandbox.window.__testHooks.getCompactLinkFavoritePresentation({
    filterGroups: [
      { label: "Type Filters", values: ["Item Category: Ring"] },
      { label: "Stat Filters", values: ["FRACTURED +#% to Item Rarity", "+# to maximum Life"] }
    ]
  }));
  assert.deepStrictEqual(result, {"stats": [{"text": "+18% to Item Rarity", "source": {"key": "fractured", "label": "FRACTURED"}}, {"text": "formatted +# to maximum Life", "source": null}], "tooltipGroups": [{"label": "Type Filters", "values": [{"text": "Item Category: Ring", "source": null}]}, {"label": "Stat Filters", "values": [{"text": "+18% to Item Rarity", "source": {"key": "fractured", "label": "FRACTURED"}}, {"text": "formatted +# to maximum Life", "source": null}]}]});
});

test("compact link tooltip renders structured stat group relationships", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCompactLinkFavoritePresentation };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const result = structuredClone(sandbox.window.__testHooks.getCompactLinkFavoritePresentation({
    localizedSnapshot: {
      stats: [
        { text: "+50 to maximum Life", source: null },
        { text: "+30% to Fire Resistance", source: null },
        { text: "+20 to maximum Mana", source: null, weight: 2 }
      ],
      statGroups: [
        { type: "or", filters: [{ text: "+50 to maximum Life", source: null }] },
        { type: "count", value: { min: 2, max: 3 }, filters: [{ text: "+30% to Fire Resistance", source: null }] },
        { type: "weighted", value: { max: 120 }, filters: [{ text: "+20 to maximum Mana", source: null, weight: 2 }] }
      ]
    },
    filterGroups: [{ label: "Other", values: ["Corrupted: No"] }]
  }));
  assert.deepStrictEqual(result, {"stats": [{"text": "+50 to maximum Life", "source": null}, {"text": "+30% to Fire Resistance", "source": null}, {"text": "+20 to maximum Mana", "source": null, "weight": 2}], "tooltipGroups": [{"label": "Other", "values": [{"text": "Corrupted: No", "source": null}]}, {"label": "Stat Filters: OR", "values": [{"text": "+50 to maximum Life", "source": null}]}, {"label": "Stat Filters: COUNT (2 - 3)", "values": [{"text": "+30% to Fire Resistance", "source": null}]}, {"label": "Stat Filters: WEIGHTED SUM (- 120)", "values": [{"text": "+20 to maximum Mana", "source": null, "weight": 2}]}]});
});

test("link favorite presentation localizes saved equipment filter labels", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getLinkFavoritePresentation, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.state = { uiLanguage: "zh_TW", pageLanguage: "zh_TW", pageTranslationEnabled: true };
  hooks.runtime.tradeLocalization = {
    strings: {
      Evasion: { en: "Evasion", zh_CN: "闪避", zh_TW: "閃避" },
      "Runic Ward": { en: "Runic Ward", zh_CN: "符文结界", zh_TW: "Runic Ward" }
    }
  };
  const result = structuredClone(hooks.getLinkFavoritePresentation({
    filterGroups: [{ label: "Equipment Filters", values: ["Evasion: 700 -", "Runic Ward: 100 -"] }]
  }));
  assert.deepStrictEqual(result, {"filterGroups": [{"label": "裝備篩選器", "values": ["閃避: 700 -", "符文保護: 100 -"]}]});
});

test("compact item favorite tooltip includes context and every modifier", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCompactFavoritePresentation };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const result = structuredClone(sandbox.window.__testHooks.getCompactFavoritePresentation({
    rarity: "rare",
    displayName: "Storm Ward",
    originalName: "Storm Ward",
    baseName: "Rider Bow",
    itemType: "Bow",
    mods: [
      { text: "+60 to maximum Life" },
      { text: "40% increased Physical Damage", source: "desecrated" }
    ]
  }));
  assert.deepStrictEqual(result, {"stats": [{"text": "+60 to maximum Life", "source": null}, {"text": "40% increased Physical Damage", "source": {"key": "desecrated", "label": "DESECRATED"}}], "tooltipGroups": [{"label": "Item", "hideLabel": true, "values": [{"text": "Storm Ward", "source": null, "heading": true}, {"text": "Base type: Rider Bow", "source": null}, {"text": "Category: Bow", "source": null}, {"text": "Rarity: RARE", "source": null}]}, {"label": "Modifiers", "values": [{"text": "+60 to maximum Life", "source": null}, {"text": "40% increased Physical Damage", "source": {"key": "desecrated", "label": "DESECRATED"}}]}]});
});

test("item favorite views label rune sanctum and skill modifiers", async () => {
  const compactBootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let compactSource = fs.readFileSync("content.js", "utf8").replace(compactBootstrapCall, "");
  compactSource = compactSource.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCompactFavoritePresentation };\n})();"
  );
  const compactSandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(compactSource, compactSandbox, { filename: "content.js" });

  let fullSource = fs.readFileSync("favorites-panel.js", "utf8");
  fullSource = fullSource.replace("  bindUi();\n  bootstrap();", "");
  fullSource = fullSource.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoriteTooltipLink };\n})();"
  );
  const fullSandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(fullSource, fullSandbox, { filename: "favorites-panel.js" });

  const favorite = {
    mods: [
      { text: "15% increased Armour", source: "rune" },
      { text: "25% chance to Avoid Resolve loss", source: "sanctum" },
      { text: "Grants Skill: Level 12 Mana Drain", source: "skill" }
    ]
  };
  const compact = structuredClone(compactSandbox.window.__testHooks.getCompactFavoritePresentation(favorite).stats);
  const fullPresentation = fullSandbox.window.__testHooks.getFavoriteTooltipLink(favorite);
  const full = structuredClone(fullPresentation.filterGroups.find((group) => group.label === "Modifiers").values);

  const expected = [{"text": "15% increased Armour", "source": {"key": "augment", "label": "AUGMENT"}}, {"text": "25% chance to Avoid Resolve loss", "source": {"key": "sanctum", "label": "SANCTUM"}}, {"text": "Grants Skill: Level 12 Mana Drain", "source": {"key": "skill", "label": "SKILL"}}];
  assert.deepStrictEqual(compact, expected);
  assert.deepStrictEqual(full, expected);
});

test("full view restores search focus and selection after filter render", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { captureSearchFocus, restoreSearchFocus, local };\n})();"
  );
  const nextSearch = {
    focusOptions: null,
    selection: null,
    focus(options) { this.focusOptions = options; },
    setSelectionRange(start, end) { this.selection = [start, end]; }
  };
  const activeSearch = {
    value: "bow",
    selectionStart: 1,
    selectionEnd: 3,
    classList: { contains(name) { return name === "favorites-panel-search"; } }
  };
  const sandbox = {
    window: {},
    document: {
      activeElement: activeSearch,
      querySelector(selector) {
        return selector === "#favorites-panel-content"
          ? { querySelector() { return nextSearch; } }
          : null;
      }
    },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.local.tab = "items";
  const focus = hooks.captureSearchFocus();
  hooks.restoreSearchFocus(focus);
  const result = structuredClone({ focus, focusOptions: nextSearch.focusOptions, selection: nextSearch.selection });
  assert.deepStrictEqual(result, {"focus": {"tab": "items", "selectionStart": 1, "selectionEnd": 3}, "focusOptions": {"preventScroll": true}, "selection": [1, 3]});
});

test("full view filters without replacing active search inputs", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { local, render };\n})();"
  );
  class Node {
    constructor(className = "") {
      this.children = [];
      this.className = className;
      this.listeners = {};
      this.attributes = {};
      this.classList = {
        contains: (name) => this.className.split(/\s+/).includes(name),
        remove() {}
      };
    }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { children.forEach((child) => this.appendChild(child)); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelector(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : "";
      const queue = [...this.children];
      while (queue.length) {
        const child = queue.shift();
        if (child.classList?.contains(className)) return child;
        queue.push(...(child.children || []));
      }
      return null;
    }
    focus() {}
    setSelectionRange() {}
  }
  const elements = {
    "#favorites-panel-title": new Node(),
    "#favorites-panel-league": new Node(),
    "#favorites-panel-compact": new Node(),
    "#favorites-panel-close": new Node(),
    "#favorites-panel-items-tab": new Node(),
    "#favorites-panel-links-tab": new Node(),
    "#favorites-panel-content": new Node(),
    "#favorites-panel-tooltip": new Node()
  };
  const document = {
    activeElement: null,
    createElement() { return new Node(); },
    querySelector(selector) { return elements[selector] || null; }
  };
  const sandbox = {
    window: { clearTimeout() {}, setTimeout() { return 1; } },
    document,
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.local.state = { available: true, favorites: [] };
  hooks.render();
  const content = elements["#favorites-panel-content"];
  const search = content.children[0].children[0].children[0];
  document.activeElement = search;
  search.value = "bow";
  search.listeners.input();
  const currentSearch = content.children[0].children[0].children[0];
  hooks.local.tab = "links";
  hooks.render();
  const linkSearch = content.children[0].children[0].children[0];
  document.activeElement = linkSearch;
  linkSearch.value = "orb";
  linkSearch.listeners.input();
  const currentLinkSearch = content.children[0].children[0].children[0];
  const result = structuredClone({
    itemInputPreserved: currentSearch === search,
    linkInputPreserved: currentLinkSearch === linkSearch,
    itemQuery: hooks.local.itemSearch,
    linkQuery: hooks.local.linkSearch
  });
  assert.deepStrictEqual(result, {"itemInputPreserved": true, "linkInputPreserved": true, "itemQuery": "bow", "linkQuery": "orb"});
});

test("full item delete feedback precedes the favorite list", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { renderItems };\n})();"
  );
  class Node {
    constructor() { this.children = []; this.className = ""; this.dataset = {}; }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { children.forEach((child) => this.appendChild(child)); }
    replaceChildren(...children) { this.children = children; }
    addEventListener() {}
    setAttribute() {}
  }
  const sandbox = {
    window: {},
    document: { createElement() { return new Node(); }, querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const root = sandbox.window.__testHooks.renderItems({ favorites: [], deletedFavorite: true });
  const result = structuredClone(root.children.flatMap((child) =>
    child.className === "favorites-panel-results"
      ? child.children.map((result) => result.className)
      : [child.className]
  ));
  assert.deepStrictEqual(result, ["favorites-panel-toolbar", "favorites-panel-feedback", "favorites-panel-empty"]);
});

test("compact item tooltip omits a base type that is already the title", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCompactFavoritePresentation };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const presentation = sandbox.window.__testHooks.getCompactFavoritePresentation({
    rarity: "rare",
    displayName: "Waystone (Tier 15)",
    baseName: "Waystone (Tier 15)",
    itemType: "Waystone",
    mods: []
  });
  const result = structuredClone(presentation.tooltipGroups[0].values);
  assert.deepStrictEqual(result, [{"text": "Waystone (Tier 15)", "source": null, "heading": true}, {"text": "Category: Waystone", "source": null}, {"text": "Rarity: RARE", "source": null}]);
});

test("full item favorite uses custom tooltip groups", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoriteTooltipLink };\n})();"
  );
  const sandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const result = structuredClone(sandbox.window.__testHooks.getFavoriteTooltipLink({
    rarity: "rare",
    displayName: "Storm Ward",
    originalName: "Storm Ward",
    baseName: "Rider Bow",
    itemType: "Bow",
    mods: [
      { text: "+60 to maximum Life" },
      { text: "40% increased Physical Damage", source: "desecrated" }
    ]
  }));
  assert.deepStrictEqual(result, {"filterGroups": [{"label": "Item", "hideLabel": true, "values": [{"text": "Storm Ward", "heading": true}, "Base type: Rider Bow", "Category: Bow", "Rarity: RARE"]}, {"label": "Modifiers", "values": ["+60 to maximum Life", {"text": "40% increased Physical Damage", "source": {"key": "desecrated", "label": "DESECRATED"}}]}]});
});

test("full item tooltip keeps the hidden item group through group normalization", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoriteTooltipLink, getLinkFavoriteTooltipGroups };\n})();"
  );
  const sandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const hooks = sandbox.window.__testHooks;
  const favorite = hooks.getFavoriteTooltipLink({
    rarity: "rare",
    displayName: "Storm Ward",
    baseName: "Rider Bow",
    itemType: "Bow",
    mods: [{ text: "+60 to maximum Life" }]
  });
  const result = structuredClone(hooks.getLinkFavoriteTooltipGroups(favorite));
  assert.deepStrictEqual(result, [{"label": "Item", "hideLabel": true, "values": [{"text": "Storm Ward", "source": null, "heading": true}, {"text": "Base type: Rider Bow", "source": null}, {"text": "Category: Bow", "source": null}, {"text": "Rarity: RARE", "source": null}]}, {"label": "Modifiers", "values": [{"text": "+60 to maximum Life", "source": null}]}]);
});

test("full view drag handles publish a recoverable drag source", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setDragSource };\n})();"
  );
  const listeners = {};
  const classes = [];
  const attributes = {};
  const element = {
    draggable: false,
    addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute(name, value) { attributes[name] = value; },
    classList: { add(value) { classes.push(value); }, remove() {} }
  };
  const data = {};
  const sandbox = {
    window: {},
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  sandbox.window.__testHooks.setDragSource(element, { kind: "link", id: "link-1", folderId: "folder-1" });
  const transfer = {
    effectAllowed: "",
    setData(type, value) { data[type] = value; }
  };
  listeners.dragstart({ dataTransfer: transfer });
  const result = structuredClone({
    draggable: element.draggable,
    draggableAttribute: attributes.draggable,
    source: JSON.parse(data["application/x-poe2-marketwright-favorite-drag"]),
    effectAllowed: transfer.effectAllowed,
    classes
  });
  assert.deepStrictEqual(result, {"draggable": true, "draggableAttribute": "true", "source": {"kind": "link", "id": "link-1", "folderId": "folder-1"}, "effectAllowed": "move", "classes": ["favorites-panel-dragging"]});
});

test("full view drop recovers the drag source from data transfer", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoritePanelDragSource };\n})();"
  );
  const sandbox = {
    window: {},
    document: { querySelector() { return null; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const sourceValue = { kind: "link", id: "link-1", folderId: "folder-1" };
  const result = structuredClone(sandbox.window.__testHooks.getFavoritePanelDragSource({
    dataTransfer: {
      getData(type) {
        return type === "application/x-poe2-marketwright-favorite-drag"
          ? JSON.stringify(sourceValue)
          : "";
      }
    }
  }));
  assert.deepStrictEqual(result, {"kind": "link", "id": "link-1", "folderId": "folder-1"});
});

test("full view drag targets show insert position and accept top level links", async () => {
  let source = fs.readFileSync("favorites-panel.js", "utf8");
  source = source.replace("  bindUi();\n  bootstrap();", "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setDragSource, setDropTarget, setGroupDropTarget, setFolderTopDropTarget };\n})();"
  );
  function makeElement() {
    const listeners = {};
    const classes = new Set();
    return {
      listeners,
      dataset: {},
      draggable: false,
      addEventListener(type, listener) { listeners[type] = listener; },
      setAttribute() {},
      getBoundingClientRect() { return { top: 100, height: 40 }; },
      contains() { return false; },
      classList: {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); }
      }
    };
  }
  const sandbox = {
    window: {},
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: { search: "" },
    URLSearchParams,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "favorites-panel.js" });
  const sourceHandle = makeElement();
  const rowTarget = makeElement();
  const rootTarget = makeElement();
  const folderTopTarget = makeElement();
  sandbox.window.__testHooks.setDragSource(sourceHandle, { kind: "link", id: "link-1", folderId: "folder-1" });
  sandbox.window.__testHooks.setDropTarget(rowTarget, { kind: "link", id: "link-2", folderId: "folder-1" });
  sandbox.window.__testHooks.setGroupDropTarget(rootTarget, null);
  sandbox.window.__testHooks.setFolderTopDropTarget(folderTopTarget, [{ id: "folder-1" }]);
  const transfer = { effectAllowed: "", setData() {}, dropEffect: "" };
  sourceHandle.listeners.dragstart({ dataTransfer: transfer });
  let rowPrevented = false;
  rowTarget.listeners.dragover({
    clientY: 130,
    dataTransfer: transfer,
    preventDefault() { rowPrevented = true; }
  });
  let rootPrevented = false;
  rootTarget.listeners.dragover({
    dataTransfer: transfer,
    preventDefault() { rootPrevented = true; }
  });
  sandbox.window.__testHooks.setDragSource(sourceHandle, { kind: "folder", id: "folder-2" });
  sourceHandle.listeners.dragstart({ dataTransfer: transfer });
  let folderTopPrevented = false;
  folderTopTarget.listeners.dragover({
    dataTransfer: transfer,
    preventDefault() { folderTopPrevented = true; }
  });
  const result = structuredClone({
    rowPrevented,
    rowPosition: rowTarget.dataset.dropPosition,
    rowHighlighted: rowTarget.classList.contains("favorites-panel-drop-target"),
    rootPrevented,
    rootHighlighted: rootTarget.classList.contains("favorites-panel-drop-target"),
    folderTopPrevented,
    folderTopPosition: folderTopTarget.dataset.dropPosition,
    folderTopHighlighted: folderTopTarget.classList.contains("favorites-panel-drop-target")
  });
  assert.deepStrictEqual(result, {"rowPrevented": true, "rowPosition": "after", "rowHighlighted": true, "rootPrevented": true, "rootHighlighted": true, "folderTopPrevented": true, "folderTopPosition": "before", "folderTopHighlighted": true});
});
