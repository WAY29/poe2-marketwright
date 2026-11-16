"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

const features = [
  ["pob-copy.js", "Poe2MarketwrightPobCopy", "createPobCopyFeature", "poe2-marketwright-pob-copy-button"],
  ["favorites.js", "Poe2MarketwrightFavorites", "createFavoriteFeature", "poe2-marketwright-favorite-button"],
  ["currency-conversion.js", "Poe2MarketwrightCurrencyConversion", "createCurrencyConversionFeature", "poe2-marketwright-currency-conversion"],
  ["affix-viewer.js", "Poe2MarketwrightAffixViewer", "createAffixViewerFeature", "poe2-marketwright-affix-viewer-button"]
];

function createFixture([filename, globalName, factoryName, controlClass]) {
  const observers = [];
  const intervals = [];
  const listeners = new Map();
  const documentQueries = [];
  let document;
  class Element {
    constructor(tagName = "div", className = "") {
      this.nodeType = 1;
      this.tagName = tagName;
      this.className = className;
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.dataset = {};
      this.style = {};
      this.textContent = "";
      this.classList = { add: (name) => { this.className = `${this.className} ${name}`.trim(); } };
    }
    get ownerDocument() { return document; }
    get parentElement() { return this.parentNode; }
    get firstChild() { return this.children[0] || null; }
    get isConnected() { return document.documentElement === this || Boolean(this.parentNode?.isConnected); }
    matches(selector) {
      return selector.split(",").some((part) => {
        const tag = part.trim().match(/^[a-z]+/);
        return (!tag || this.tagName === tag[0]) &&
          [...part.matchAll(/\.([\w-]+)/g)].every((match) => this.className.split(" ").includes(match[1])) &&
          [...part.matchAll(/\[([\w-]+)(?:(\^?=)["']([^"']*)["'])?\]/g)].every((match) =>
            match[2] === undefined ? this.getAttribute(match[1]) !== null
              : match[2] === "^=" ? Boolean(this.getAttribute(match[1])?.startsWith(match[3]))
                : this.getAttribute(match[1]) === match[3]);
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener() {}
    appendChild(child) { this.append(child); return child; }
    append(...children) {
      for (const child of children) {
        child.remove();
        child.parentNode = this;
        this.children.push(child);
      }
    }
    insertBefore(child, before) {
      this.append(child);
      if (before) {
        this.children.pop();
        this.children.splice(this.children.indexOf(before), 0, child);
      }
    }
    insertAdjacentElement(position, child) {
      assert.equal(position, "afterend");
      this.parentNode.insertBefore(child, this.parentNode.children[this.parentNode.children.indexOf(this) + 1]);
    }
    remove() {
      if (this.parentNode) {
        this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
        this.parentNode = null;
      }
    }
  }
  const root = new Element("html");
  const body = new Element("body");
  root.append(body);
  document = {
    documentElement: root,
    body,
    createElement: (tag) => new Element(tag),
    addEventListener() {},
    querySelectorAll(selector) { documentQueries.push(selector); return root.querySelectorAll(selector); }
  };
  const window = {
    location: { href: "https://www.pathofexile.com/trade2/search/poe2/Test%20League/query-1" },
    addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
    postMessage() {},
    setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length; }
  };
  const sandbox = {
    console, document, window, location: window.location, Element, Node: { ELEMENT_NODE: 1 },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target) { this.target = target; }
    }
  };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
  const feature = sandbox[globalName][factoryName]({
    getPageId: () => "Rings", effectsByPage: { Rings: { prefix: ["explicit.stat_life"] } }
  });
  const data = (id) => ({ result: [{
    id, item: { rarity: "Rare", typeLine: "Gold Ring", explicitMods: ["+10 to maximum Life"] },
    listing: { price: { type: "~price", amount: 1, currency: "exalted" } }
  }] });
  const createRow = (id, ready = true) => {
    const row = new Element("div", "row");
    row.setAttribute("data-id", id);
    if (ready) fillRow(row);
    return row;
  };
  const fillRow = (row) => {
    const left = new Element("div", "left");
    const price = new Element("span");
    price.setAttribute("data-field", "price");
    price.append(new Element("span", "price-label"));
    left.append(new Element("span", "verifiedStatus"));
    row.append(left, price);
  };
  const mutate = (target, addedNodes = [], removedNodes = []) => {
    for (const observer of observers) {
      observer.callback([{ type: "childList", target, addedNodes, removedNodes }]);
    }
  };
  return {
    feature, document, window, body, root, observers, intervals, listeners, documentQueries,
    Element, createRow, fillRow, mutate, data, controlClass,
    store: (id) => filename === "currency-conversion.js"
      ? feature.storeResults(data(id), "Test League") : feature.storeResults(data(id)),
    control: (row) => row.querySelector(`.${controlClass}`)
  };
}

for (const config of features) {
  test(`${config[0]} restores controls after a partial row render without polling`, () => {
    const f = createFixture(config);
    f.store("item-1");
    f.feature.start();
    const row = f.createRow("item-1", false);
    f.body.append(row);
    f.mutate(f.body, [row]);
    assert.equal(f.control(row), null);

    f.fillRow(row);
    f.mutate(row, [...row.children]);
    assert.ok(f.control(row), "late row contents must be handled without a timer");

    const control = f.control(row);
    const parent = control.parentNode;
    control.remove();
    f.mutate(parent, [], [control]);
    assert.ok(f.control(row), "native partial rerenders must restore a removed control");
    if (config[0] === "currency-conversion.js") {
      assert.equal(row.querySelectorAll(".poe2-marketwright-currency-conversion-value").length, 1);
      assert.equal(row.querySelectorAll(".poe2-marketwright-currency-conversion-break").length, 1);
    }
    f.mutate(f.control(row).parentNode, [f.control(row)]);
    assert.equal(row.querySelectorAll(`.${f.controlClass}`).length, 1);
    assert.equal(f.intervals.length, 0, "idle pages must not schedule repeated scans");
  });

  test(`${config[0]} handles delayed data and remounts from a persistent observer`, () => {
    const f = createFixture(config);
    const row = f.createRow("item-1");
    f.body.append(row);
    f.feature.start();
    f.store("item-1");
    assert.ok(f.control(row), "API data arriving after the row must update the control");
    assert.ok(f.observers[0].target === f.root, "the observer must survive container replacement");

    f.body.remove();
    const body = new f.Element("body");
    const replacement = f.createRow("item-1");
    body.append(replacement);
    f.root.append(body);
    f.mutate(f.root, [body], [f.body]);
    assert.ok(f.control(replacement), "replacing the Trade container must keep controls working");
  });

  test(`${config[0]} ignores unrelated mutations and avoids a document scan for a new row`, () => {
    const f = createFixture(config);
    f.store("item-1");
    f.feature.start();
    f.documentQueries.length = 0;
    const unrelated = new f.Element("span");
    f.body.append(unrelated);
    f.mutate(f.body, [unrelated]);
    const row = f.createRow("item-1");
    f.body.append(row);
    f.mutate(f.body, [row]);
    assert.ok(f.control(row));
    assert.deepEqual(f.documentQueries, []);
  });
}

test("currency navigation reads the current URL without polling or following a stale fetch", () => {
  const f = createFixture(features[2]);
  f.feature.start();
  f.window.location.href = "https://www.pathofexile.com/trade2/search/poe2/New%20League/query-2";
  f.listeners.get("popstate").forEach((listener) => listener());
  assert.equal(f.feature.getActiveLeagueContext().league, "New League");
  f.feature.handleMessage({
    source: f.window,
    data: { source: "poe2-marketwright-currency-conversion", type: "fetch", league: "Old League", body: '{"result":[]}' }
  });
  assert.equal(f.feature.getActiveLeagueContext().league, "New League");
  f.window.location.href = "https://www.pathofexile.com/trade2";
  f.listeners.get("hashchange").forEach((listener) => listener());
  assert.equal(f.feature.getActiveLeagueContext().league, null);
});

for (const config of features.slice(0, 3)) {
  test(`${config[0]} keeps its toggle working without a periodic scan`, () => {
    const f = createFixture(config);
    const row = f.createRow("item-1");
    f.body.append(row);
    f.store("item-1");
    f.feature.start();
    f.feature.setEnabled(false);
    assert.equal(f.control(row), null);
    f.mutate(row, [new f.Element("span")]);
    assert.equal(f.control(row), null);
    f.feature.setEnabled(true);
    assert.ok(f.control(row));
    assert.equal(f.intervals.length, 0);
  });
}

test("Trade startup waits for a real DOM event and stops observing after the app is ready", () => {
  const f = createFixture(features[0]);
  let callback;
  let disconnected = false;
  const window = { ...f.window };
  const source = fs.readFileSync("page-bridge.js", "utf8")
    .replace(`  waitForTradeApp();\n  installTradeApiHook();\n  notifyReady();`, "")
    .replace(/\n\}\)\(\);\s*$/, "\n  window.__testHooks = { waitForTradeApp, runtime };\n})();");
  window.document = f.document;
  window.setTimeout = () => assert.fail("Trade startup must not poll");
  const sandbox = {
    window, console,
    MutationObserver: class {
      constructor(listener) { callback = listener; }
      observe(target) { assert.ok(target === f.root); }
      disconnect() { disconnected = true; }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "page-bridge.js" });
  let readyListener;
  f.document.documentElement = null;
  f.document.addEventListener = (event, listener, options) => {
    assert.equal(event, "DOMContentLoaded");
    assert.equal(options.once, true);
    readyListener = listener;
  };
  window.__testHooks.waitForTradeApp();
  assert.equal(typeof readyListener, "function");
  f.document.documentElement = f.root;
  f.document.addEventListener = () => {};
  readyListener();
  assert.equal(typeof callback, "function");
  window.app = { $data: { static_: { knownStats: [] } } };
  callback();
  assert.equal(disconnected, true);
  assert.equal(window.__testHooks.runtime.appObserver, null);
});

test("Tier observes native filter changes while ignoring its own rendering and result activity", () => {
  let callback;
  let timers = 0;
  let pending;
  const source = fs.readFileSync("page-bridge.js", "utf8")
    .replace(`  waitForTradeApp();\n  installTradeApiHook();\n  notifyReady();`, "")
    .replace(/\n\}\)\(\);\s*$/, "\n  window.__testHooks = { installTierControls };\n})();");
  const window = {
    document: { documentElement: {}, addEventListener() {} },
    addEventListener() {}, postMessage() {}, setTimeout(listener) { pending = listener; timers += 1; return timers; }
  };
  const sandbox = {
    window, console,
    MutationObserver: class { constructor(listener) { callback = listener; } observe() {} }
  };
  vm.runInNewContext(source, sandbox, { filename: "page-bridge.js" });
  window.__testHooks.installTierControls();
  const unrelated = { nodeType: 1, matches: () => false, querySelector: () => null };
  callback([{ addedNodes: [unrelated], removedNodes: [] }]);
  callback([{ target: { closest: () => ({}) }, addedNodes: [{ nodeType: 3 }], removedNodes: [] }]);
  assert.equal(timers, 0);
  const nativeRow = {
    nodeType: 1,
    matches: (selector) => selector.split(",").some((part) => part.trim() === ".filter")
  };
  callback([{ addedNodes: [nativeRow], removedNodes: [] }]);
  callback([{ addedNodes: [], removedNodes: [nativeRow] }]);
  assert.equal(timers, 1, "native structural changes should share one pending update");
  pending();
  callback([{
    target: { closest: (selector) => selector.startsWith("#trade ") ? { querySelector: () => ({}) } : null },
    addedNodes: [{ nodeType: 3 }], removedNodes: []
  }]);
  assert.equal(timers, 2, "updating a native stat row in place must still refresh its Tier");
});

test("quick-add bindings refresh for new native inputs and coalesce pending updates", () => {
  const f = createFixture(features[0]);
  let callback;
  const timers = [];
  f.window.setTimeout = (listener) => { timers.push(listener); return timers.length; };
  const source = fs.readFileSync("content.js", "utf8")
    .replace(`  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`, "")
    .replace(/\n\}\)\(\);\s*$/, `
  bindFavoriteStorageSync = bindFavoritesPanelMessages = bindTradeControlListeners =
    bindTradeInteractionListeners = bindQuickAddListeners = () => {};
  window.__testHooks = { bindGlobalListeners };
})();`);
  const sandbox = {
    window: f.window, document: f.document, location: { pathname: "/trade2" }, console,
    MutationObserver: class { constructor(listener) { callback = listener; } observe() {} }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  f.window.__testHooks.bindGlobalListeners();
  callback([{ addedNodes: [new f.Element("button")], removedNodes: [] }]);
  assert.equal(timers.length, 0);
  const input = new f.Element("input", "multiselect__input");
  callback([{ addedNodes: [input], removedNodes: [] }]);
  callback([{ addedNodes: [], removedNodes: [input] }]);
  assert.equal(timers.length, 1);
  timers[0]();
  const replacement = new f.Element("div");
  replacement.append(input);
  callback([{ addedNodes: [replacement], removedNodes: [] }]);
  assert.equal(timers.length, 2);
});

test("localization ignores extension controls and handles native item changes and remounted titles", () => {
  const f = createFixture(features[0]);
  const source = fs.readFileSync("content.js", "utf8")
    .replace(`  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`, "")
    .replace(/\n\}\)\(\);\s*$/, "\n  window.__testHooks = { runtime, isTradeResultLocalizationMutation, getTradeResultLocalizationElements, localizeTradeElement };\n})();");
  const sandbox = { window: {}, document: f.document, Element: f.Element, location: { pathname: "/trade2" }, console };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const { runtime, isTradeResultLocalizationMutation, getTradeResultLocalizationElements, localizeTradeElement } = sandbox.window.__testHooks;
  const row = f.createRow("item-1");
  row.className += " result";
  const button = new f.Element("button", "poe2-marketwright-favorite-button");
  const icon = new f.Element("svg");
  button.append(icon);
  row.append(button);
  assert.equal(isTradeResultLocalizationMutation({ target: button, addedNodes: [icon] }), false);
  const stat = new f.Element("span", "poe2-marketwright-result-stat-matched");
  row.append(stat);
  assert.equal(isTradeResultLocalizationMutation({ target: stat }), true);

  const group = new f.Element("div", "filter-group");
  const title = new f.Element("div", "filter-title-clickable");
  group.append(title);
  f.body.append(group);
  assert.equal(isTradeResultLocalizationMutation({ target: f.body, addedNodes: [group] }), true);
  assert.ok(getTradeResultLocalizationElements(f.body).has(title));
  let text = "Stat Filters";
  let writes = 0;
  title.childNodes = [{
    nodeType: 3,
    parentElement: title,
    get nodeValue() { return text; },
    set nodeValue(value) { text = value; writes++; }
  }];
  runtime.state.pageLanguage = "zh_TW_en";
  localizeTradeElement(title);
  localizeTradeElement(title);
  assert.equal(text, "屬性篩選器 (Stat Filters)");
  assert.equal(writes, 1);
  text = "Stat Filters";
  localizeTradeElement(title);
  assert.equal(text, "屬性篩選器 (Stat Filters)");
  assert.equal(writes, 2);
  for (const [language, expected] of [
    ["en", "Stat Filters"],
    ["zh_CN", "属性筛选器"],
    ["zh_TW", "屬性篩選器"],
    ["zh_CN_en", "属性筛选器 (Stat Filters)"],
    ["zh_TW_en", "屬性篩選器 (Stat Filters)"]
  ]) {
    runtime.state.pageLanguage = language;
    localizeTradeElement(title);
    assert.equal(text, expected);
    const previousWrites = writes;
    localizeTradeElement(title);
    assert.equal(writes, previousWrites);
  }
  runtime.state.pageTranslationEnabled = false;
  localizeTradeElement(title);
  assert.equal(text, "Stat Filters");
});
