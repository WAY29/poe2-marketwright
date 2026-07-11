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
  const result = structuredClone({
    migrated: migrated.uiLanguage,
    saved: saved.uiLanguage,
    normalized: hooks.resolveUiLanguage("unsupported")
  });
  assert.deepStrictEqual(result, {"migrated": "zh_TW", "saved": "zh_CN", "normalized": "zh_TW"});
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

test("collapsed panel keeps toggle anchor and restores saved position", async () => {
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
    panelPosition: { left: 240, top: 180 },
    collapsedPosition: { left: 500, top: 300 }
  };
  hooks.applyPanelPosition();
  const collapsedStyle = { ...root.style };

  hooks.runtime.state.collapsed = false;
  hooks.applyPanelPosition();

  const result = structuredClone({ collapsedStyle, expandedStyle: root.style });
  assert.deepStrictEqual(result, {"collapsedStyle": {"left": "500px", "top": "300px", "right": "auto"}, "expandedStyle": {"left": "240px", "top": "180px", "right": "auto"}});
});

test("expanding from the collapsed mark keeps the toggle at the mark position", async () => {
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
    chrome: { storage: { local: { set: async () => {} } } }
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
    panelPosition: { left: 600, top: 200 },
    collapsedPosition: { left: 600, top: 200 }
  };

  await hooks.setPanelCollapsed(false);
  const result = structuredClone({ panelPosition: hooks.runtime.state.panelPosition, style: root.style });
  assert.deepStrictEqual(result, {"panelPosition": {"left": 407, "top": 200}, "style": {"left": "407px", "top": "200px", "right": "auto"}});
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
      version: 1,
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
