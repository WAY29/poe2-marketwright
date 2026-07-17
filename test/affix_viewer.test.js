"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("groups category effects and conservatively normalizes current item stat sources", () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("affix-viewer.js", "utf8"), sandbox, {
    filename: "affix-viewer.js"
  });

  const tools = sandbox.Poe2MarketwrightAffixViewer.createAffixViewerTools();
  const effectsByPage = {
    Rings: {
      prefix: ["explicit.stat_life"],
      suffix: ["explicit.stat_strength"],
      other: ["implicit.stat_max_chaos_resistance", "rune.stat_fire_resistance"]
    }
  };
  const item = {
    rarity: "Rare",
    explicitMods: [{ hash: "explicit.stat_life" }],
    fracturedMods: [{ hash: "fractured.stat_strength" }],
    craftedMods: ["+20 to maximum Life"],
    runeMods: [{ hash: "rune.stat_fire_resistance" }],
    implicitMods: [{ hash: "implicit.stat_max_chaos_resistance" }],
    extended: { hashes: { crafted: [["crafted.stat_life", null]] } }
  };

  const result = structuredClone({
    groups: tools.getEffectGroups(effectsByPage, "Rings"),
    matched: Array.from(tools.getMatchedEffectIds(item)).sort(),
    uniqueMatched: Array.from(tools.getMatchedEffectIds({ ...item, rarity: "Unique" })).sort(),
    domMatched: Array.from(
      tools.getMatchedEffectIds(
        { rarity: "Rare" },
        { querySelectorAll: () => [{ getAttribute: () => "stat.explicit.stat_life" }] }
      )
    ).sort()
  });

  assert.deepStrictEqual(result, {
    groups: [
      { id: "prefix", statIds: ["explicit.stat_life"] },
      { id: "suffix", statIds: ["explicit.stat_strength"] },
      { id: "other", statIds: ["implicit.stat_max_chaos_resistance", "rune.stat_fire_resistance"] }
    ],
    matched: [
      "explicit.stat_life",
      "explicit.stat_strength",
      "rune.stat_fire_resistance"
    ],
    uniqueMatched: ["rune.stat_fire_resistance"],
    domMatched: ["explicit.stat_life"]
  });
});

test("positions an affix panel above its trigger when below would overflow the viewport", () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("affix-viewer.js", "utf8"), sandbox, {
    filename: "affix-viewer.js"
  });

  const tools = sandbox.Poe2MarketwrightAffixViewer.createAffixViewerTools();
  const above = structuredClone(
    tools.getPanelPlacement({ top: 650, bottom: 674 }, { top: 600 }, 360, 720)
  );
  const constrainedAbove = structuredClone(
    tools.getPanelPlacement({ top: 260, bottom: 284 }, { top: 200 }, 300, 360)
  );

  assert.deepStrictEqual(above, { top: -314, maxHeight: null });
  assert.deepStrictEqual(constrainedAbove, { top: -192, maxHeight: 248 });
});

test("page bridge replays the latest fetch for the affix viewer", async () => {
  const listeners = [];
  const messages = [];
  const body = JSON.stringify({ result: [{ id: "item-1", item: { typeLine: "Gold Ring" } }] });
  const window = {
    app: { $data: { static_: { knownStats: [] } } },
    addEventListener(type, listener) {
      if (type === "message") listeners.push(listener);
    },
    postMessage(message) {
      messages.push(message);
    },
    fetch() {
      return Promise.resolve({ clone: () => ({ text: () => Promise.resolve(body) }) });
    }
  };

  vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), { window, console }, {
    filename: "page-bridge.js"
  });
  await window.fetch("/api/trade2/fetch/item-1?query=query-1");
  await new Promise((resolve) => setTimeout(resolve, 0));
  listeners[0]({
    source: window,
    data: { source: "poe2-marketwright", type: "POE2_MARKETWRIGHT_AFFIX_VIEWER_REQUEST" }
  });

  const result = structuredClone(messages.filter((message) => message.source === "poe2-marketwright-affix-viewer"));
  assert.deepStrictEqual(result, [
    { source: "poe2-marketwright-affix-viewer", url: "/api/trade2/fetch/item-1?query=query-1", body },
    { source: "poe2-marketwright-affix-viewer", url: "/api/trade2/fetch/item-1?query=query-1", body }
  ]);
});

test("affix panel is positioned below its trigger instead of widening the result row", () => {
  const source = fs.readFileSync("affix-viewer.js", "utf8");
  const styles = fs.readFileSync("content.css", "utf8");

  assert.match(source, /host\.appendChild\(panel\);/);
  assert.match(source, /panel\.style\.top = `\$\{buttonBox\.bottom - hostBox\.top \+ 4\}px`;/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-panel\s*\{[\s\S]*position:\s*absolute;/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-host\s*\{[\s\S]*position:\s*relative\s*!important;/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-host\s*\{[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-panel\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-panel\s*\{[\s\S]*width:\s*min\(800px, calc\(100vw - 24px\)\);/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-panel-effect\s*\{[\s\S]*white-space:\s*nowrap;/);
  assert.match(styles, /\.poe2-marketwright-affix-viewer-panel::-webkit-scrollbar/);
  assert.match(
    styles,
    /\.poe2-marketwright-affix-viewer-panel-group--other \.poe2-marketwright-affix-viewer-panel-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\)\s*\{[\s\S]*\.poe2-marketwright-affix-viewer-panel-group--other \.poe2-marketwright-affix-viewer-panel-list\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/
  );
});

test("affix viewer closes its open panel on Escape and outside clicks", () => {
  const source = fs.readFileSync("affix-viewer.js", "utf8");

  assert.match(source, /const handleDocumentClick = \(event\) => \{/);
  assert.match(source, /!openPanelElement\.contains\(event\.target\)/);
  assert.match(source, /const handleDocumentKeydown = \(event\) => \{/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("click", handleDocumentClick\);/);
  assert.match(source, /document\.addEventListener\("keydown", handleDocumentKeydown\);/);
});

test("affix viewer follows the Trade page language instead of the extension UI language", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getAffixViewerPresentationLanguage, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  sandbox.window.__testHooks.runtime.state = {
    pageLanguage: "zh_TW",
    uiLanguage: "zh_CN",
    pageTranslationEnabled: true
  };

  assert.equal(sandbox.window.__testHooks.getAffixViewerPresentationLanguage(), "zh_TW");
});
