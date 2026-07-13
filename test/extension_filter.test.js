"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("page bridge applies native multi-token search only to item and stat selectors", () => {
  const bootstrapCall = `  waitForTradeApp();\n  installTradeApiHook();\n  notifyReady();`;
  let source = fs
    .readFileSync("page-bridge.js", "utf8")
    .replace(bootstrapCall, "")
    .replace(
      /\n\}\)\(\);\s*$/,
      "\n  window.__testHooks = { getNativeWhitespaceSearchQuery, patchWhitespaceSearchFilter, isWhitespaceSearchTarget, installWhitespaceSearch, runtime };\n})();"
    );
  const listeners = [];
  const sandbox = {
    window: {
      addEventListener() {},
      postMessage() {},
      document: { addEventListener(type, listener) { listeners.push({ type, listener }); } }
    },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "page-bridge.js" });

  const hooks = sandbox.window.__testHooks;
  const evaluated = [];
  const parent = {
    underline(text, search) {
      return search ? `native:${text}:${search}` : String(text);
    }
  };
  const item = {
    search: "金 戒指",
    $el: { matches(selector) { return selector.includes("search-bar"); } },
    $parent: parent,
    options: [{ label: "Items", entries: [{ text: "金光戒指" }, { text: "铜戒指" }] }],
    groupValues: "entries",
    groupLabel: "label",
    label: "text",
    internalSearch: true,
    hideSelected: false,
    taggable: false,
    optionsLimit: 500,
    filterAndFlat(groups, query) {
      evaluated.push(query);
      return query === "~金 戒指" ? [groups[0].entries[0]] : [];
    },
    underline(text, search) {
      return search ? `native:${text}:${search}` : String(text);
    },
    _computedWatchers: {
      filteredOptions: {
        getter() {
          return [];
        }
      }
    }
  };
  const stat = {
    search: "maximum life",
    options: [{ entries: [{ id: "explicit.stat_life", text: "+# to maximum Life" }] }],
    $el: { matches() { return false; } },
    _computedWatchers: { filteredOptions: { getter() { return this.search; } } }
  };
  const unrelated = {
    search: "gold ring",
    options: [{ entries: [{ type: "Gold Ring" }] }],
    $el: { matches() { return false; } },
    _computedWatchers: { filteredOptions: { getter() { return this.search; } } }
  };

  assert.equal(hooks.getNativeWhitespaceSearchQuery("金 戒指"), "~金 戒指");
  assert.equal(hooks.getNativeWhitespaceSearchQuery(" gold  ring "), "~gold ring");
  assert.equal(hooks.getNativeWhitespaceSearchQuery("戒指"), null);
  assert.equal(hooks.getNativeWhitespaceSearchQuery("~金 戒指"), null);
  assert.equal(hooks.isWhitespaceSearchTarget(item), true);
  assert.equal(hooks.isWhitespaceSearchTarget(stat), true);
  assert.equal(hooks.isWhitespaceSearchTarget(unrelated), false);

  hooks.runtime.app = { $children: [{ $refs: { search: item } }] };
  hooks.installWhitespaceSearch();
  assert.equal(listeners.length, 1);
  assert.deepStrictEqual(item._computedWatchers.filteredOptions.getter.call(item), [{ text: "金光戒指" }]);
  assert.equal(item.search, "金 戒指");
  assert.deepStrictEqual(evaluated, ["~金 戒指"]);
  assert.equal(item.underline("金光戒指", "金 戒指"), "<strong>金</strong>光<strong>戒指</strong>");
  assert.equal(item.underline("金光戒指", "~金 戒指"), "native:金光戒指:~金 戒指");
  assert.equal(parent.underline("金光戒指", "金 戒指"), "<strong>金</strong>光<strong>戒指</strong>");
});

test("page bridge limits Tier options to the selected exact category", () => {
  const bootstrapCall = `  waitForTradeApp();\n  installTradeApiHook();\n  notifyReady();`;
  let source = fs
    .readFileSync("page-bridge.js", "utf8")
    .replace(bootstrapCall, "")
    .replace(
      /\n\}\)\(\);\s*$/,
      "\n  window.__testHooks = { getTierOptions, runtime };\n})();"
    );
  const sandbox = {
    window: { addEventListener() {}, postMessage() {}, document: {} },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "page-bridge.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.tierMappings = {
    Rings: { "explicit.stat_damage": [{ tier: 1, min: 17 }] },
    Belts: { "explicit.stat_damage": [{ tier: 1, min: 25 }] }
  };
  hooks.runtime.tierPageLabels = { Rings: "戒指", Belts: "腰带" };

  const global = structuredClone(hooks.getTierOptions("explicit.stat_damage"));
  hooks.runtime.tierPageId = "Rings";
  const exact = structuredClone(hooks.getTierOptions("explicit.stat_damage"));
  assert.deepStrictEqual(global, [
    { tier: 1, min: 25, pageId: "Belts", label: "腰带 T1" },
    { tier: 1, min: 17, pageId: "Rings", label: "戒指 T1" }
  ]);
  assert.deepStrictEqual(exact, [{ tier: 1, min: 17, pageId: "Rings", label: "T1" }]);
});

test("page bridge inserts a Tier selector for a Vue stat filter and updates min", () => {
  const bootstrapCall = `  waitForTradeApp();\n  installTradeApiHook();\n  notifyReady();`;
  let source = fs
    .readFileSync("page-bridge.js", "utf8")
    .replace(bootstrapCall, "")
    .replace(
      /\n\}\)\(\);\s*$/,
      "\n  window.__testHooks = { getTierStatId, installTierControls, refreshTierControls, runtime };\n})();"
    );

  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = options.bubbles;
    }
  }

  class FakeElement {
    constructor(ownerDocument) {
      this.ownerDocument = ownerDocument;
      this.children = [];
      this.listeners = new Map();
      this.attributes = {};
      this.emitted = [];
      this.className = "";
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        contains: (name) => classes.has(name),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, force) => {
          const enabled = force === undefined ? !classes.has(name) : force;
          if (enabled) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
          return enabled;
        }
      };
      this.value = "";
    }

    addEventListener(type, listener) {
      this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    replaceChildren() {
      this.children = [];
    }

    querySelector(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : "";
      return this.children.find((child) => child.className === className) || null;
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    dispatchEvent(event) {
      this.emitted.push(event.type);
      for (const listener of this.listeners.get(event.type) || []) {
        listener.call(this, event);
      }
      return true;
    }

    contains(target) {
      return target === this || this.children.some((child) => child.contains?.(target));
    }

    remove() {
      this.removed = true;
    }
  }

  class FakeInput extends FakeElement {
    constructor(ownerDocument) {
      super(ownerDocument);
      this._value = "";
    }

    get value() {
      return this._value;
    }

    set value(value) {
      this._value = String(value);
    }

    before(control) {
      this.tierControl = control;
    }
  }

  let filter;
  const documentListeners = new Map();
  const document = {
    documentElement: {},
    addEventListener(type, listener) {
      documentListeners.set(type, [...(documentListeners.get(type) || []), listener]);
    },
    createElement() {
      return new FakeElement(document);
    },
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      return selector === "#trade .search-advanced-pane .filter" ? [filter] : [];
    }
  };
  const input = new FakeInput(document);
  const maxInput = new FakeInput(document);
  const filterBody = new FakeElement(document);
  filter = {
    __vue__: { filter: { id: "explicit.stat_3032590688" } },
    parentElement: null,
    children: [filterBody],
    insertBefore(control, before) {
      this.children.splice(this.children.indexOf(before), 0, control);
      control.parentElement = this;
      return control;
    },
    querySelector(selector) {
      if (selector === "input.minmax") {
        return input;
      }
      if (selector === ".filter-body") {
        return filterBody;
      }
      if (selector === ".poe2-marketwright-tier-control") {
        return this.children.find((child) => child.className === "poe2-marketwright-tier-control") || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      return selector === "input.minmax" ? [input, maxInput] : [];
    }
  };
  class FakeMutationObserver {
    constructor() {}

    observe() {}
  }
  const sandbox = {
    window: {
      addEventListener() {},
      postMessage() {},
      document,
      Event: FakeEvent,
      HTMLInputElement: FakeInput
    },
    MutationObserver: FakeMutationObserver,
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "page-bridge.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.tierMappings = {
    Rings: {
      "explicit.stat_3032590688": [
        { tier: 1, min: 20.6, exactMin: 17, exactMax: 25.5 },
        { tier: 2, exactMin: 14, exactMax: 20.5 }
      ]
    }
  };
  hooks.runtime.tierPageLabels = { Rings: "Rings" };

  assert.equal(hooks.getTierStatId(filter), "explicit.stat_3032590688");
  hooks.refreshTierControls();

  const control = filter.querySelector(".poe2-marketwright-tier-control");
  const select = control.querySelector(".poe2-marketwright-tier-select");
  const trigger = control.querySelector(".poe2-marketwright-tier-trigger");
  assert.equal(control.parentElement, filter);
  assert.equal(filter.children.indexOf(control), filter.children.indexOf(filterBody) - 1);
  assert.equal(select.attributes["aria-label"], "Tier");
  assert.equal(trigger.textContent, "T");
  assert.equal(select.size, 3);
  assert.deepEqual(select.children.map((option) => option.textContent), ["Tier", "Rings T1", "Rings T2"]);

  hooks.installTierControls();
  trigger.dispatchEvent(new FakeEvent("click"));
  assert.equal(control.classList.contains("poe2-marketwright-tier-control-open"), true);
  documentListeners.get("pointerdown")[0]({ target: {} });
  assert.equal(control.classList.contains("poe2-marketwright-tier-control-open"), false);

  select.value = "Rings:1";
  select.dispatchEvent(new FakeEvent("change"));
  assert.equal(input.value, "20.6");
  assert.equal(maxInput.value, "");
  assert.equal(trigger.textContent, "T1");

  select.value = "Rings:2";
  select.dispatchEvent(new FakeEvent("change"));
  assert.equal(input.value, "");
  assert.equal(trigger.textContent, "T2");

  hooks.runtime.tierMode = "exact";
  select.value = "Rings:1";
  select.dispatchEvent(new FakeEvent("change"));
  assert.equal(input.value, "17");
  assert.equal(maxInput.value, "25.5");

  hooks.runtime.tierMode = "minimum";
  select.value = "Rings:1";
  select.dispatchEvent(new FakeEvent("change"));
  assert.equal(input.value, "20.6");
  assert.equal(maxInput.value, "25.5");
});

test("page bridge hides unmatched known stats but keeps related pseudo", async () => {
  const listeners = [];
  const staticData = {
    knownStats: [
      {
        id: "pseudo",
        entries: [
          { id: "pseudo.pseudo_total_strength", text: "# total to Strength" },
          { id: "pseudo.pseudo_total_maximum_life", text: "# total maximum Life" },
          { id: "pseudo.pseudo_number_of_empty_prefix_mods", text: "# Empty Prefix Modifiers" },
          { id: "pseudo.pseudo_number_of_suffix_mods", text: "# Suffix Modifiers" },
          { id: "pseudo.pseudo_number_of_uses_remaining", text: "# uses remaining (Tablets)" }
        ]
      },
      {
        id: "explicit",
        entries: [
          { id: "explicit.stat_strength", text: "# to Strength" },
          { id: "explicit.stat_dexterity", text: "# to Dexterity" },
          { id: "explicit.stat_unclassified", text: "# unclassified future stat" }
        ]
      }
    ]
  };
  const window = {
    app: { $data: { static_: staticData } },
    addEventListener(type, listener) {
      if (type === "message") {
        listeners.push(listener);
      }
    },
    postMessage() {},
    setTimeout() {
      throw new Error("trade app should be captured synchronously");
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
      payload: {
        enabled: true,
        allowedKeys: [],
        allowedStatIds: ["explicit.stat_strength"],
        allStatIds: ["explicit.stat_strength", "explicit.stat_dexterity"],
        allKeys: ["# to strength", "# to dexterity"]
      }
    }
  });

  const result = structuredClone(staticData.knownStats);
  const groups = Object.fromEntries((result).map((group) => [group["id"], group["entries"]]));
  assert.deepStrictEqual((groups["pseudo"]).map((entry) => entry["id"]), ["pseudo.pseudo_total_strength", "pseudo.pseudo_number_of_empty_prefix_mods", "pseudo.pseudo_number_of_suffix_mods", "pseudo.pseudo_number_of_uses_remaining"]);
  assert.deepStrictEqual((groups["explicit"]).map((entry) => entry["id"]), ["explicit.stat_strength"]);
});

test("content filter keeps related pseudo options", async () => {

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }

    contains(name) {
      return this.values.has(name);
    }

    toggle(name, force) {
      if (force === undefined) {
        force = !this.values.has(name);
      }
      if (force) {
        this.values.add(name);
      } else {
        this.values.delete(name);
      }
      return this.values.has(name);
    }
  }

  class FakeElement {
    constructor(text, attributes = {}) {
      this.innerText = text;
      this.textContent = text;
      this.attributes = attributes;
      this.children = [];
      this.classList = new FakeClassList();
      this.id = attributes.id || "";
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }

    getClientRects() {
      return [{}];
    }

    matches() {
      return false;
    }

    querySelectorAll() {
      return this.children;
    }
  }

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { filterOptionGroup, runtime, HIDDEN_CLASS };\n})();"
  );

  const window = {
    addEventListener() {},
    clearTimeout() {},
    getComputedStyle() {
      return { display: "block", visibility: "visible", opacity: "1" };
    },
    innerHeight: 768,
    innerWidth: 1024,
    setTimeout() {
      return 1;
    }
  };
  const document = {};
  const location = { pathname: "/trade2" };
  const sandbox = {
    window,
    document,
    location,
    console,
    Element: FakeElement,
    HTMLInputElement: class extends FakeElement {},
    HTMLTextAreaElement: class extends FakeElement {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const root = new FakeElement("");
  const pseudoStrengthById = new FakeElement("# total to Strength", {
    "data-id": "pseudo.pseudo_total_strength"
  });
  const pseudoStrengthByText = new FakeElement("Pseudo: # total to Strength");
  const pseudoLife = new FakeElement("Pseudo: # total maximum Life", {
    "data-id": "pseudo.pseudo_total_maximum_life"
  });
  const pseudoEmptyPrefix = new FakeElement("# Empty Prefix Modifiers", {
    "data-id": "pseudo.pseudo_number_of_empty_prefix_mods"
  });
  const pseudoSuffixByText = new FakeElement("Pseudo: # Suffix Modifiers");
  const pseudoEmptyPrefixZh = new FakeElement("Pseudo: 空前缀");
  const pseudoUsesRemaining = new FakeElement("# uses remaining (Tablets)", {
    "data-id": "pseudo.pseudo_number_of_uses_remaining"
  });
  const explicitKeep = new FakeElement("+# to Strength", {
    "data-id": "explicit.stat_strength"
  });
  const explicitHide = new FakeElement("+# to Dexterity", {
    "data-id": "explicit.stat_dexterity"
  });
  const explicitUnclassified = new FakeElement("# new future stat", {
    "data-id": "explicit.stat_unclassified"
  });
  const explicitPipeKeep = new FakeElement("# timeless stat", {
    "data-id": "explicit.stat_timeless|1"
  });
  root.children = [
    pseudoStrengthById,
    pseudoStrengthByText,
    pseudoLife,
    pseudoEmptyPrefix,
    pseudoSuffixByText,
    pseudoEmptyPrefixZh,
    pseudoUsesRemaining,
    explicitKeep,
    explicitHide,
    explicitUnclassified,
    explicitPipeKeep
  ];

  const hooks = window.__testHooks;
  hooks.runtime.ui.root = { contains() { return false; } };
  hooks.runtime.allPatterns = new Set([
    "# total to strength",
    "# total maximum life",
    "# to strength",
    "# to dexterity"
  ]);
  hooks.runtime.allStatIds = new Set([
    "explicit.stat_strength",
    "explicit.stat_dexterity",
    "explicit.stat_timeless|1"
  ]);

  const stats = { groups: 0, options: 0, matched: 0, hidden: 0 };
  hooks.filterOptionGroup(
    root,
    new Set(["# to strength"]),
    new Set(["explicit.stat_strength", "explicit.stat_timeless|1"]),
    stats
  );

  const result = structuredClone({
    hiddenClass: hooks.HIDDEN_CLASS,
    pseudoStrengthByIdHidden: pseudoStrengthById.classList.contains(hooks.HIDDEN_CLASS),
    pseudoStrengthByTextHidden: pseudoStrengthByText.classList.contains(hooks.HIDDEN_CLASS),
    pseudoLifeHidden: pseudoLife.classList.contains(hooks.HIDDEN_CLASS),
    pseudoEmptyPrefixHidden: pseudoEmptyPrefix.classList.contains(hooks.HIDDEN_CLASS),
    pseudoSuffixByTextHidden: pseudoSuffixByText.classList.contains(hooks.HIDDEN_CLASS),
    pseudoEmptyPrefixZhHidden: pseudoEmptyPrefixZh.classList.contains(hooks.HIDDEN_CLASS),
    pseudoUsesRemainingHidden: pseudoUsesRemaining.classList.contains(hooks.HIDDEN_CLASS),
    explicitKeepHidden: explicitKeep.classList.contains(hooks.HIDDEN_CLASS),
    explicitHideHidden: explicitHide.classList.contains(hooks.HIDDEN_CLASS),
    explicitUnclassifiedHidden: explicitUnclassified.classList.contains(hooks.HIDDEN_CLASS),
    explicitPipeKeepHidden: explicitPipeKeep.classList.contains(hooks.HIDDEN_CLASS),
    stats
  });
  assert.equal(result["pseudoStrengthByIdHidden"], false);
  assert.equal(result["pseudoStrengthByTextHidden"], false);
  assert.equal(result["pseudoLifeHidden"], true);
  assert.equal(result["pseudoEmptyPrefixHidden"], false);
  assert.equal(result["pseudoSuffixByTextHidden"], false);
  assert.equal(result["pseudoEmptyPrefixZhHidden"], false);
  assert.equal(result["pseudoUsesRemainingHidden"], false);
  assert.equal(result["explicitKeepHidden"], false);
  assert.equal(result["explicitHideHidden"], true);
  assert.equal(result["explicitUnclassifiedHidden"], true);
  assert.equal(result["explicitPipeKeepHidden"], false);
  assert.deepStrictEqual(result["stats"]["hidden"], 3);
});

test("content filter keeps resistance count when resistance is allowed", async () => {

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }

    contains(name) {
      return this.values.has(name);
    }

    toggle(name, force) {
      if (force === undefined) {
        force = !this.values.has(name);
      }
      if (force) {
        this.values.add(name);
      } else {
        this.values.delete(name);
      }
      return this.values.has(name);
    }
  }

  class FakeElement {
    constructor(text, attributes = {}) {
      this.innerText = text;
      this.textContent = text;
      this.attributes = attributes;
      this.children = [];
      this.classList = new FakeClassList();
      this.id = attributes.id || "";
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }

    getClientRects() {
      return [{}];
    }

    matches() {
      return false;
    }

    querySelectorAll() {
      return this.children;
    }
  }

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { filterOptionGroup, runtime, HIDDEN_CLASS };\n})();"
  );

  const window = {
    addEventListener() {},
    clearTimeout() {},
    getComputedStyle() {
      return { display: "block", visibility: "visible", opacity: "1" };
    },
    innerHeight: 768,
    innerWidth: 1024,
    setTimeout() {
      return 1;
    }
  };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: FakeElement,
    HTMLInputElement: class extends FakeElement {},
    HTMLTextAreaElement: class extends FakeElement {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const root = new FakeElement("");
  const pseudoCountResistances = new FakeElement("# total Resistances", {
    "data-id": "pseudo.pseudo_count_resistances"
  });
  const pseudoStrength = new FakeElement("# total to Strength", {
    "data-id": "pseudo.pseudo_total_strength"
  });
  const explicitColdResistance = new FakeElement("+#% to Cold Resistance", {
    "data-id": "explicit.stat_cold_resistance"
  });
  root.children = [pseudoCountResistances, pseudoStrength, explicitColdResistance];

  const hooks = window.__testHooks;
  hooks.runtime.ui.root = { contains() { return false; } };
  hooks.runtime.allPatterns = new Set([
    "# total resistances",
    "# total to strength",
    "#% to cold resistance"
  ]);
  hooks.runtime.allStatIds = new Set([
    "explicit.stat_cold_resistance"
  ]);

  const stats = { groups: 0, options: 0, matched: 0, hidden: 0 };
  hooks.filterOptionGroup(
    root,
    new Set(["#% to cold resistance"]),
    new Set(["explicit.stat_cold_resistance"]),
    stats
  );

  const result = structuredClone({
    pseudoCountResistancesHidden: pseudoCountResistances.classList.contains(hooks.HIDDEN_CLASS),
    pseudoStrengthHidden: pseudoStrength.classList.contains(hooks.HIDDEN_CLASS),
    explicitColdResistanceHidden: explicitColdResistance.classList.contains(hooks.HIDDEN_CLASS)
  });
  assert.equal(result["pseudoCountResistancesHidden"], false);
  assert.equal(result["pseudoStrengthHidden"], true);
  assert.equal(result["explicitColdResistanceHidden"], false);
});

test("content filter does not keep pseudo for incidental token overlap", async () => {

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }

    contains(name) {
      return this.values.has(name);
    }

    toggle(name, force) {
      if (force === undefined) {
        force = !this.values.has(name);
      }
      if (force) {
        this.values.add(name);
      } else {
        this.values.delete(name);
      }
      return this.values.has(name);
    }
  }

  class FakeElement {
    constructor(text, attributes = {}) {
      this.innerText = text;
      this.textContent = text;
      this.attributes = attributes;
      this.children = [];
      this.classList = new FakeClassList();
      this.id = attributes.id || "";
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }

    getClientRects() {
      return [{}];
    }

    matches() {
      return false;
    }

    querySelectorAll() {
      return this.children;
    }
  }

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { filterOptionGroup, runtime, HIDDEN_CLASS };\n})();"
  );

  const window = {
    addEventListener() {},
    clearTimeout() {},
    getComputedStyle() {
      return { display: "block", visibility: "visible", opacity: "1" };
    },
    innerHeight: 768,
    innerWidth: 1024,
    setTimeout() {
      return 1;
    }
  };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: FakeElement,
    HTMLInputElement: class extends FakeElement {},
    HTMLTextAreaElement: class extends FakeElement {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const root = new FakeElement("");
  const pseudoStrength = new FakeElement("# total to Strength", {
    "data-id": "pseudo.pseudo_total_strength"
  });
  const explicitDamagePerStrength = new FakeElement("#% increased Damage per # Strength", {
    "data-id": "explicit.stat_damage_per_strength"
  });
  const explicitOther = new FakeElement("+# to Dexterity", {
    "data-id": "explicit.stat_dexterity"
  });
  root.children = [pseudoStrength, explicitDamagePerStrength, explicitOther];

  const hooks = window.__testHooks;
  hooks.runtime.ui.root = { contains() { return false; } };
  hooks.runtime.allPatterns = new Set([
    "# total to strength",
    "#% increased damage per # strength",
    "# to dexterity"
  ]);
  hooks.runtime.allStatIds = new Set([
    "explicit.stat_damage_per_strength",
    "explicit.stat_dexterity"
  ]);

  const stats = { groups: 0, options: 0, matched: 0, hidden: 0 };
  hooks.filterOptionGroup(
    root,
    new Set(["#% increased damage per # strength"]),
    new Set(["explicit.stat_damage_per_strength"]),
    stats
  );

  const result = structuredClone({
    pseudoStrengthHidden: pseudoStrength.classList.contains(hooks.HIDDEN_CLASS),
    explicitDamagePerStrengthHidden: explicitDamagePerStrength.classList.contains(hooks.HIDDEN_CLASS),
    explicitOtherHidden: explicitOther.classList.contains(hooks.HIDDEN_CLASS)
  });
  assert.equal(result["pseudoStrengthHidden"], true);
  assert.equal(result["explicitDamagePerStrengthHidden"], false);
  assert.equal(result["explicitOtherHidden"], true);
});

test("content auto detect overrides special map items", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { inferSelectionFromTexts, runtime };\n})();"
  );

  const window = {
    addEventListener() {},
    clearTimeout() {},
    getComputedStyle() {
      return { display: "block", visibility: "visible", opacity: "1" };
    },
    innerHeight: 768,
    innerWidth: 1024,
    setTimeout() {
      return 1;
    }
  };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const hooks = window.__testHooks;
  hooks.runtime.data = {
    itemNameToPage: {
      "expedition logbook": "Expedition_Tablet"
    },
    itemNameToSelection: {
      "expedition logbook": { kind: "logical", id: "Maps" },
      "探险日志": { kind: "logical", id: "Maps" },
      "探險日誌": { kind: "logical", id: "Maps" }
    },
    logicalCategories: {
      Maps: { pageSlugs: ["Expedition_Tablet"] }
    }
  };
  hooks.runtime.itemLookupEntries = [
    "expedition logbook",
    "探险日志",
    "探險日誌"
  ];
  hooks.runtime.categoryAliasToSelection = {
    "探险碑牌": { kind: "page", id: "Expedition_Tablet" }
  };
  hooks.runtime.categoryLookupEntries = ["探险碑牌"];

  const detectItem = (text) => hooks.inferSelectionFromTexts(new Set([text]), {
    allowItems: true,
    allowCategories: false
  });

  const result = structuredClone({
    simplifiedLogbook: detectItem("探险日志"),
    traditionalLogbook: detectItem("探險日誌"),
    englishLogbook: detectItem("Expedition Logbook"),
    expeditionTablet: detectItem("探险碑牌")
  });
  assert.deepStrictEqual(result["simplifiedLogbook"], {"kind": "logical", "id": "Maps", "source": "item", "match": "探险日志"});
  assert.deepStrictEqual(result["traditionalLogbook"], {"kind": "logical", "id": "Maps", "source": "item", "match": "探險日誌"});
  assert.deepStrictEqual(result["englishLogbook"], {"kind": "logical", "id": "Maps", "source": "item", "match": "expedition logbook"});
  assert.deepStrictEqual(result["expeditionTablet"], {"kind": "page", "id": "Expedition_Tablet", "source": "item", "match": "探险碑牌"});
});

test("content adds the selected unique base type stat union", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getAllowedPatterns, getAllowedStatIds, inferSelectionFromTexts, runtime };\n})();"
  );
  const window = { addEventListener() {} };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const hooks = window.__testHooks;
  hooks.runtime.state = { filteringEnabled: true };
  hooks.runtime.data = {
    itemNameToSelection: {
      "從無到有 鑽石": { kind: "page", id: "Ruby" }
    },
    uniqueItemTypeByName: {
      "從無到有 鑽石": "diamond"
    },
    uniqueItemTypeArtifacts: {
      diamond: {
        allowedPatterns: ["Other Diamond Modifier"],
        allowedStatIds: ["explicit.stat_other_diamond"]
      }
    },
    itemNameToPage: {},
    pageCategories: {
      Ruby: {
        allowedPatterns: ["Passives in Radius can be Allocated without being connected to your tree"],
        allowedStatIds: ["explicit.stat_radius_passives"]
      }
    },
    logicalCategories: {}
  };
  hooks.runtime.itemLookupEntries = ["從無到有 鑽石"];
  hooks.runtime.categoryAliasToSelection = {
    鑽石: { kind: "page", id: "Diamond" }
  };
  hooks.runtime.categoryLookupEntries = ["鑽石"];

  const selection = hooks.inferSelectionFromTexts(new Set(["從無到有 鑽石"]), {
    allowItems: true,
    allowCategories: false
  });
  const result = structuredClone({
    selection,
    patterns: Array.from(hooks.getAllowedPatterns(selection)).sort(),
    statIds: Array.from(hooks.getAllowedStatIds(selection)).sort()
  });
  assert.deepStrictEqual(result, {
    selection: {
      kind: "page",
      id: "Ruby",
      uniqueItemType: "diamond",
      source: "item",
      match: "從無到有 鑽石"
    },
    patterns: [
      "other diamond modifier",
      "passives in radius can be allocated without being connected to your tree"
    ],
    statIds: ["explicit.stat_other_diamond", "explicit.stat_radius_passives"]
  });
});

test("content prioritizes a selected unique over a conflicting category", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { chooseActiveSelection, runtime };\n})();"
  );
  const sandbox = {
    window: { addEventListener() {} },
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const hooks = sandbox.window.__testHooks;
  const unique = { kind: "page", id: "Diamond", uniqueItemType: "diamond" };
  const category = { kind: "page", id: "Ruby" };
  const ordinary = { kind: "page", id: "Diamond" };
  assert.deepStrictEqual(structuredClone({
    unique: hooks.chooseActiveSelection(unique, category),
    ordinary: hooks.chooseActiveSelection(ordinary, category)
  }), {
    unique,
    ordinary: category
  });
});

test("content classifies favorite by base name and trade category", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoriteItemClassification, runtime };\n})();"
  );

  const window = {
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.data = {
    itemNameToSelection: {
      "warmonger bow": { kind: "page", id: "Bows" }
    },
    itemNameToPage: {}
  };

  const result = structuredClone(hooks.getFavoriteItemClassification({
    name: "Spirit Fletch",
    typeLine: "Warmonger Bow"
  }));
  assert.deepStrictEqual(result, {"baseName": "Warmonger Bow", "category": "weapon.bow", "itemType": "Bow", "selection": {"kind": "page", "id": "Bows"}});
});

test("content ignores unsupported favorite items without logging on repeated refreshes", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getFavoriteItemClassification, runtime };\n})();"
  );

  const warnings = [];
  const window = {
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console: { warn(...args) { warnings.push(args); } },
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.data = { itemNameToPage: {}, itemNameToSelection: {} };

  const unsupportedCurrency = { typeLine: "Aldur's Saga" };
  const result = structuredClone([
    hooks.getFavoriteItemClassification(unsupportedCurrency),
    hooks.getFavoriteItemClassification(unsupportedCurrency)
  ]);

  assert.deepStrictEqual(result, [null, null]);
  assert.deepStrictEqual(warnings, []);
});

test("current link favorite uses selected base name for its default name", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCurrentLinkFavoriteContext, getLinkFavoriteDisplayNameFromSelections, runtime };\n})();"
  );

  const selected = {
    textContent: "Warmonger Bow",
    getAttribute() { return ""; }
  };
  const itemRoot = {
    matches() { return true; },
    closest() { return null; },
    querySelectorAll() { return [selected]; }
  };
  const document = {
    querySelector(selector) {
      if (selector.includes("input.multiselect__input")) return null;
      if (selector.includes("search-bar")) return itemRoot;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
      pathname: "/trade2/search/poe2/Dawn/query-1"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document,
    location: window.location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {},
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) {
            return {
              url,
              league: "Dawn",
              queryId: "query-1"
            };
          }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.data = {
    itemNameToSelection: {
      "warmonger bow": { kind: "page", id: "Bows" }
    },
    itemNameToPage: {}
  };
  hooks.runtime.categoryAliasToSelection = {
    bows: { kind: "page", id: "Bows" }
  };
  const result = structuredClone({
    context: hooks.getCurrentLinkFavoriteContext(),
    categoryName: hooks.getLinkFavoriteDisplayNameFromSelections([], ["Bows"]),
    unnamed: hooks.getLinkFavoriteDisplayNameFromSelections([], [])
  });
  assert.deepStrictEqual(result, {"context": {"url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1", "league": "Dawn", "queryId": "query-1", "displayName": "Warmonger Bow"}, "categoryName": "Bows", "unnamed": "Unnamed search"});
});

test("current link favorite remains available when Trade rerenders its filter DOM", () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { getCurrentLinkFavoriteContext };\n})();"
  );
  const location = {
    href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
    pathname: "/trade2/search/poe2/Dawn/query-1"
  };
  const sandbox = {
    window: { location, addEventListener() {} },
    document: {
      querySelector() { throw new Error("Trade is rendering"); },
      querySelectorAll() { throw new Error("Trade is rendering"); }
    },
    location,
    console,
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) { return { url, league: "Dawn", queryId: "query-1" }; }
        };
      }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const result = structuredClone(sandbox.window.__testHooks.getCurrentLinkFavoriteContext());
  assert.deepStrictEqual(result, {"url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1", "league": "Dawn", "queryId": "query-1", "displayName": "Unnamed search"});
});

test("link favorite state refreshes when a search URL changes within the same league", async () => {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { startSelectionPolling, runtime };\n})();"
  );
  let poll;
  const messages = [];
  const location = {
    href: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur",
    pathname: "/trade2/search/poe2/Runes%20of%20Aldur"
  };
  const sandbox = {
    window: {
      location,
      addEventListener() {},
      clearTimeout() {},
      setTimeout() { return 1; },
      setInterval(callback) { poll = callback; return 1; }
    },
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {
      runtime: {
        sendMessage(message) {
          messages.push(message);
          return Promise.resolve();
        }
      }
    },
    Poe2MarketwrightFavorites: {
      createFavoriteTools() {
        return { getLeagueFromTradeUrl() { return "Runes of Aldur"; } };
      },
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) {
            if (!/\/search\/poe2\/Runes%20of%20Aldur\/[^/]+$/.test(url)) {
              throw new Error("query id required");
            }
            return { url, league: "Runes of Aldur", queryId: "aywJY5cJ" };
          }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = sandbox.window.__testHooks;
  hooks.runtime.favoritesPanelSessionId = "panel-session";
  hooks.startSelectionPolling();
  location.href = "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/aywJY5cJ";
  location.pathname = "/trade2/search/poe2/Runes%20of%20Aldur/aywJY5cJ";
  poll();
  await Promise.resolve();

  assert.equal(hooks.runtime.linkFavoriteLocationHref, location.href);
  assert.equal(messages.at(-1).state.canSaveCurrentLink, true);
});

test("dragging a link to another folder moves it into that folder", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setLinkFavoriteDropTarget, runtime };\n})();"
  );

  const handlers = {};
  const target = {
    classList: { add() {}, remove() {} },
    addEventListener(type, listener) { handlers[type] = listener; },
    getBoundingClientRect() { return { top: 0, height: 20 }; }
  };
  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
      pathname: "/trade2/search/poe2/Dawn/query-1"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: window.location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: { storage: { local: { set: async () => {} } } },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) { return { url, league: "Dawn", queryId: "query-1" }; },
          normalizeLinkFavoritesState(state) { return state; }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state.linkFavorites = {
    version: 1,
    leagues: {
      Dawn: {
        folders: [{ id: "folder-b", name: "Bows", createdAt: 1, collapsed: false }],
        folderOrder: ["folder-b"],
        links: [{
          id: "root-link",
          league: "Dawn",
          queryId: "query-1",
          url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
          displayName: "Warmonger Bow",
          folderId: null,
          createdAt: 2,
          lastUsedAt: null
        }],
        rootLinkIds: ["root-link"],
        folderLinkIds: { "folder-b": [] }
      }
    }
  };
  hooks.runtime.linkFavoriteDrag = { kind: "link", id: "root-link", folderId: null };
  hooks.setLinkFavoriteDropTarget(target, { kind: "link", id: "target-link", folderId: "folder-b" });
  handlers.drop({
    preventDefault() {},
    stopPropagation() {},
    clientY: 10
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = structuredClone(hooks.runtime.state.linkFavorites.leagues.Dawn);
  assert.deepStrictEqual(result["rootLinkIds"], []);
  assert.deepStrictEqual(result["folderLinkIds"], {"folder-b": ["root-link"]});
  assert.deepStrictEqual(result["links"][0]["folderId"], "folder-b");
});

test("dragging a link to another folder uses the previewed insert position", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setLinkFavoriteDropTarget, runtime };\n})();"
  );

  const handlers = {};
  const target = {
    classList: { add() {}, remove() {} },
    dataset: {},
    addEventListener(type, listener) { handlers[type] = listener; },
    getBoundingClientRect() { return { top: 0, height: 20 }; }
  };
  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
      pathname: "/trade2/search/poe2/Dawn/query-1"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: window.location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: { storage: { local: { set: async () => {} } } },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) { return { url, league: "Dawn", queryId: "query-1" }; },
          normalizeLinkFavoritesState(state) { return state; }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state.linkFavorites = {
    version: 1,
    leagues: {
      Dawn: {
        folders: [{ id: "folder-b", name: "Bows", createdAt: 1, collapsed: true }],
        folderOrder: ["folder-b"],
        links: [
          {
            id: "root-link",
            league: "Dawn",
            queryId: "query-1",
            url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
            displayName: "Root bookmark",
            folderId: null,
            createdAt: 2,
            lastUsedAt: null
          },
          {
            id: "target-link",
            league: "Dawn",
            queryId: "query-2",
            url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-2",
            displayName: "Folder bookmark",
            folderId: "folder-b",
            createdAt: 3,
            lastUsedAt: null
          }
        ],
        rootLinkIds: ["root-link"],
        folderLinkIds: { "folder-b": ["target-link"] }
      }
    }
  };
  hooks.runtime.linkFavoriteDrag = { kind: "link", id: "root-link", folderId: null };
  hooks.setLinkFavoriteDropTarget(target, { kind: "link", id: "target-link", folderId: "folder-b" });
  handlers.drop({
    preventDefault() {},
    stopPropagation() {},
    clientY: 1
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const league = hooks.runtime.state.linkFavorites.leagues.Dawn;
  const result = structuredClone({
    folderLinkIds: league.folderLinkIds,
    collapsed: league.folders[0].collapsed
  });
  assert.deepStrictEqual(result, {"folderLinkIds": {"folder-b": ["root-link", "target-link"]}, "collapsed": false});
});

test("dragging a folder to the top drop area moves it to the top", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setLinkFavoriteFolderTopDropTarget, runtime };\n})();"
  );

  const handlers = {};
  const target = {
    classList: { add() {}, remove() {} },
    addEventListener(type, listener) { handlers[type] = listener; }
  };
  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
      pathname: "/trade2/search/poe2/Dawn/query-1"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: window.location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: { storage: { local: { set: async () => {} } } },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) { return { url, league: "Dawn", queryId: "query-1" }; },
          normalizeLinkFavoritesState(state) { return state; }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state.linkFavorites = {
    version: 1,
    leagues: {
      Dawn: {
        folders: [
          { id: "folder-a", name: "Axes", createdAt: 1, collapsed: false },
          { id: "folder-b", name: "Bows", createdAt: 2, collapsed: false }
        ],
        folderOrder: ["folder-a", "folder-b"],
        links: [],
        rootLinkIds: [],
        folderLinkIds: { "folder-a": [], "folder-b": [] }
      }
    }
  };
  hooks.runtime.linkFavoriteDrag = { kind: "folder", id: "folder-b" };
  hooks.setLinkFavoriteFolderTopDropTarget(target);
  handlers.drop({ preventDefault() {}, stopPropagation() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = structuredClone(hooks.runtime.state.linkFavorites.leagues.Dawn.folderOrder);
  assert.deepStrictEqual(result, ["folder-b", "folder-a"]);
});

test("dragging a folder link to the root drop area moves it to the top level", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setLinkFavoriteGroupDropTarget, runtime };\n})();"
  );

  const handlers = {};
  const target = {
    classList: { add() {}, remove() {} },
    addEventListener(type, listener) { handlers[type] = listener; }
  };
  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
      pathname: "/trade2/search/poe2/Dawn/query-1"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: window.location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: { storage: { local: { set: async () => {} } } },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) { return { url, league: "Dawn", queryId: "query-1" }; },
          normalizeLinkFavoritesState(state) { return state; }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state.linkFavorites = {
    version: 1,
    leagues: {
      Dawn: {
        folders: [{ id: "folder-b", name: "Bows", createdAt: 1, collapsed: false }],
        folderOrder: ["folder-b"],
        links: [{
          id: "folder-link",
          league: "Dawn",
          queryId: "query-1",
          url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
          displayName: "Warmonger Bow",
          folderId: "folder-b",
          createdAt: 2,
          lastUsedAt: null
        }],
        rootLinkIds: [],
        folderLinkIds: { "folder-b": ["folder-link"] }
      }
    }
  };
  hooks.runtime.linkFavoriteDrag = { kind: "link", id: "folder-link", folderId: "folder-b" };
  hooks.setLinkFavoriteGroupDropTarget(target, null);
  handlers.drop({
    preventDefault() {},
    stopPropagation() {}
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = structuredClone(hooks.runtime.state.linkFavorites.leagues.Dawn);
  assert.deepStrictEqual(result["rootLinkIds"], ["folder-link"]);
  assert.deepStrictEqual(result["folderLinkIds"], {"folder-b": []});
  assert.equal(result["links"][0]["folderId"], null);
});

test("link favorites render on a league search root without a query id", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { renderLinkFavoritesDrawer, runtime };\n})();"
  );

  class Node {
    constructor() {
      this.children = [];
      this.classList = { add() {}, remove() {}, toggle() {} };
      this.dataset = {};
      this.style = {};
    }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { children.forEach((child) => this.appendChild(child)); }
    replaceChildren(...children) { this.children = children; }
    addEventListener() {}
    setAttribute() {}
    focus() {}
    select() {}
  }
  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn",
      pathname: "/trade2/search/poe2/Dawn"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: {
      createElement() { return new Node(); },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    location: window.location,
    console,
    Element: Node,
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: { storage: { local: { set: async () => {} } } },
    Poe2MarketwrightFavorites: {
      createFavoriteTools() {
        return {
          getLeagueFromTradeUrl() { return "Dawn"; }
        };
      },
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl() { throw new Error("query id required"); },
          normalizeLinkFavoritesState(state) { return state; }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state = {
    linkFavoritesEnabled: true,
    linkFavorites: {
      version: 1,
      leagues: {
        Dawn: {
          folders: [{ id: "folder-b", name: "Bows", createdAt: 1, collapsed: false }],
          folderOrder: ["folder-b"],
          links: [],
          rootLinkIds: [],
          folderLinkIds: { "folder-b": [] }
        }
      }
    }
  };
  hooks.runtime.ui = {
    linkFavoritesLeague: new Node(),
    linkFavoritesList: new Node(),
    linkFavoritesNewFolder: new Node(),
    linkFavoritesSaveRoot: new Node(),
    linkFavoritesFeedback: new Node(),
    linkFavoritesFeedbackText: new Node(),
    linkFavoritesFeedbackUndo: new Node()
  };
  hooks.renderLinkFavoritesDrawer();
  const result = structuredClone(hooks.runtime.ui.linkFavoritesList.children.map((child) => child.className));
  assert.deepStrictEqual(result, ["poe2-marketwright-link-favorite-folder-top-drop-area", "poe2-marketwright-link-favorite-group", "poe2-marketwright-link-favorite-root"]);
});

test("collapsing all link favorite folders updates every folder", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { setAllLinkFavoriteFoldersCollapsed, runtime };\n})();"
  );

  const window = {
    location: {
      href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
      pathname: "/trade2/search/poe2/Dawn/query-1"
    },
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: { querySelector() { return null; }, querySelectorAll() { return []; } },
    location: window.location,
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: { storage: { local: { set: async () => {} } } },
    Poe2MarketwrightFavorites: {
      createLinkFavoriteTools() {
        return {
          validateTradeSearchUrl(url) { return { url, league: "Dawn", queryId: "query-1" }; },
          normalizeLinkFavoritesState(state) { return state; }
        };
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state.linkFavorites = {
    version: 1,
    leagues: {
      Dawn: {
        folders: [
          { id: "folder-a", name: "Axes", createdAt: 1, collapsed: false },
          { id: "folder-b", name: "Bows", createdAt: 2, collapsed: true }
        ],
        folderOrder: ["folder-a", "folder-b"],
        links: [],
        rootLinkIds: [],
        folderLinkIds: { "folder-a": [], "folder-b": [] }
      }
    }
  };
  await hooks.setAllLinkFavoriteFoldersCollapsed(true);
  const result = structuredClone(hooks.runtime.state.linkFavorites.leagues.Dawn.folders.map((folder) => folder.collapsed));
  assert.deepStrictEqual(result, [true, true]);
});

test("link favorite undo control resides in header feedback", async () => {
  const source = fs.readFileSync("content.js", "utf8");
  assert.ok((source).includes("id=\"poe2-marketwright-link-favorites-feedback-undo\""));
  assert.ok(!(source).includes("id=\"poe2-marketwright-link-favorites-undo\""));
  assert.ok((source).includes("id=\"poe2-marketwright-favorites-feedback-undo\""));
  assert.ok(!(source).includes("id=\"poe2-marketwright-favorites-undo\""));
});

test("favorites disclosure uses the full feature row and keeps its switch independent", async () => {

  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  const originalSource = fs.readFileSync("content.js", "utf8");
  let source = originalSource.replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.__testHooks = { applyFavoritesDrawerState, runtime };\n})();"
  );

  const classes = new Set();
  const disclosure = {
    attributes: {},
    disabled: null,
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  const window = {
    addEventListener() {},
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const sandbox = {
    window,
    document: {},
    location: { pathname: "/trade2" },
    console,
    Element: class {},
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    MutationObserver: class {},
    chrome: {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  const hooks = window.__testHooks;
  hooks.runtime.state = {
    favoritesEnabled: true,
    favoritesDrawerOpen: true,
    collapsed: false
  };
  hooks.runtime.ui = {
    root: {
      classList: {
        toggle(name, value) {
          if (value) classes.add(name);
          else classes.delete(name);
        }
      }
    },
    favoritesDisclosure: disclosure
  };
  hooks.applyFavoritesDrawerState();
  const enabled = {
    expanded: disclosure.attributes["aria-expanded"],
    disabled: disclosure.disabled,
    openClass: classes.has("poe2-marketwright-favorites-open")
  };

  hooks.runtime.state.favoritesEnabled = false;
  hooks.applyFavoritesDrawerState();
  const result = structuredClone({
    hasDisclosure: originalSource.includes("poe2-marketwright-favorites-disclosure"),
    hasLegacyArrow: originalSource.includes("poe2-marketwright-favorites-toggle"),
    enabled,
    disabled: disclosure.disabled
  });
  assert.deepStrictEqual(result, {"hasDisclosure": true, "hasLegacyArrow": false, "enabled": {"expanded": "true", "disabled": false, "openClass": true}, "disabled": true});
});
