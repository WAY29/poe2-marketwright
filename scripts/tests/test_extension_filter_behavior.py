import json
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class ExtensionFilterBehaviorTests(unittest.TestCase):
    def run_node(self, script: str) -> object:
        result = subprocess.run(
            ["node", "-e", textwrap.dedent(script)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            self.fail(result.stderr or result.stdout)
        return json.loads(result.stdout)

    def test_page_bridge_hides_unmatched_known_stats_but_keeps_related_pseudo(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");
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

            console.log(JSON.stringify(staticData.knownStats));
            """
        )

        groups = {group["id"]: group["entries"] for group in result}
        self.assertEqual(
            [entry["id"] for entry in groups["pseudo"]],
            [
                "pseudo.pseudo_total_strength",
                "pseudo.pseudo_number_of_empty_prefix_mods",
                "pseudo.pseudo_number_of_suffix_mods",
                "pseudo.pseudo_number_of_uses_remaining",
            ],
        )
        self.assertEqual(
            [entry["id"] for entry in groups["explicit"]],
            ["explicit.stat_strength"],
        )

    def test_content_filter_keeps_related_pseudo_options(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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

            console.log(JSON.stringify({
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
            }));
            """
        )

        self.assertFalse(result["pseudoStrengthByIdHidden"])
        self.assertFalse(result["pseudoStrengthByTextHidden"])
        self.assertTrue(result["pseudoLifeHidden"])
        self.assertFalse(result["pseudoEmptyPrefixHidden"])
        self.assertFalse(result["pseudoSuffixByTextHidden"])
        self.assertFalse(result["pseudoEmptyPrefixZhHidden"])
        self.assertFalse(result["pseudoUsesRemainingHidden"])
        self.assertFalse(result["explicitKeepHidden"])
        self.assertTrue(result["explicitHideHidden"])
        self.assertTrue(result["explicitUnclassifiedHidden"])
        self.assertFalse(result["explicitPipeKeepHidden"])
        self.assertEqual(result["stats"]["hidden"], 3)

    def test_content_filter_keeps_resistance_count_when_resistance_is_allowed(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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

            console.log(JSON.stringify({
              pseudoCountResistancesHidden: pseudoCountResistances.classList.contains(hooks.HIDDEN_CLASS),
              pseudoStrengthHidden: pseudoStrength.classList.contains(hooks.HIDDEN_CLASS),
              explicitColdResistanceHidden: explicitColdResistance.classList.contains(hooks.HIDDEN_CLASS)
            }));
            """
        )

        self.assertFalse(result["pseudoCountResistancesHidden"])
        self.assertTrue(result["pseudoStrengthHidden"])
        self.assertFalse(result["explicitColdResistanceHidden"])

    def test_content_filter_does_not_keep_pseudo_for_incidental_token_overlap(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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

            console.log(JSON.stringify({
              pseudoStrengthHidden: pseudoStrength.classList.contains(hooks.HIDDEN_CLASS),
              explicitDamagePerStrengthHidden: explicitDamagePerStrength.classList.contains(hooks.HIDDEN_CLASS),
              explicitOtherHidden: explicitOther.classList.contains(hooks.HIDDEN_CLASS)
            }));
            """
        )

        self.assertTrue(result["pseudoStrengthHidden"])
        self.assertFalse(result["explicitDamagePerStrengthHidden"])
        self.assertTrue(result["explicitOtherHidden"])

    def test_content_auto_detect_overrides_special_map_items(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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

            console.log(JSON.stringify({
              simplifiedLogbook: detectItem("探险日志"),
              traditionalLogbook: detectItem("探險日誌"),
              englishLogbook: detectItem("Expedition Logbook"),
              expeditionTablet: detectItem("探险碑牌")
            }));
            """
        )

        self.assertEqual(result["simplifiedLogbook"], {"kind": "logical", "id": "Maps", "source": "item", "match": "探险日志"})
        self.assertEqual(result["traditionalLogbook"], {"kind": "logical", "id": "Maps", "source": "item", "match": "探險日誌"})
        self.assertEqual(result["englishLogbook"], {"kind": "logical", "id": "Maps", "source": "item", "match": "expedition logbook"})
        self.assertEqual(result["expeditionTablet"], {"kind": "page", "id": "Expedition_Tablet", "source": "item", "match": "探险碑牌"})

    def test_content_classifies_favorite_by_base_name_and_trade_category(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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

            console.log(JSON.stringify(hooks.getFavoriteItemClassification({
              name: "Spirit Fletch",
              typeLine: "Warmonger Bow"
            })));
            """
        )

        self.assertEqual(
            result,
            {
                "baseName": "Warmonger Bow",
                "category": "weapon.bow",
                "itemType": "Bow",
                "selection": {"kind": "page", "id": "Bows"},
            },
        )

    def test_current_link_favorite_uses_selected_base_name_for_its_default_name(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify({
              context: hooks.getCurrentLinkFavoriteContext(),
              categoryName: hooks.getLinkFavoriteDisplayNameFromSelections([], ["Bows"]),
              unnamed: hooks.getLinkFavoriteDisplayNameFromSelections([], [])
            }));
            """
        )

        self.assertEqual(
            result,
            {
                "context": {
                    "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
                    "league": "Dawn",
                    "queryId": "query-1",
                    "displayName": "Warmonger Bow",
                },
                "categoryName": "Bows",
                "unnamed": "Unnamed search",
            },
        )

    def test_dragging_a_link_to_another_folder_moves_it_into_that_folder(self) -> None:
        result = self.run_node(
            r"""
            (async () => {
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify(hooks.runtime.state.linkFavorites.leagues.Dawn));
            })();
            """
        )

        self.assertEqual(
            result["rootLinkIds"],
            [],
        )
        self.assertEqual(result["folderLinkIds"], {"folder-b": ["root-link"]})
        self.assertEqual(result["links"][0]["folderId"], "folder-b")

    def test_dragging_a_link_to_another_folder_uses_the_previewed_insert_position(self) -> None:
        result = self.run_node(
            r"""
            (async () => {
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify({
              folderLinkIds: league.folderLinkIds,
              collapsed: league.folders[0].collapsed
            }));
            })();
            """
        )

        self.assertEqual(
            result,
            {
                "folderLinkIds": {"folder-b": ["root-link", "target-link"]},
                "collapsed": False,
            },
        )

    def test_dragging_a_folder_to_the_top_drop_area_moves_it_to_the_top(self) -> None:
        result = self.run_node(
            r"""
            (async () => {
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify(hooks.runtime.state.linkFavorites.leagues.Dawn.folderOrder));
            })();
            """
        )

        self.assertEqual(result, ["folder-b", "folder-a"])

    def test_dragging_a_folder_link_to_the_root_drop_area_moves_it_to_the_top_level(self) -> None:
        result = self.run_node(
            r"""
            (async () => {
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify(hooks.runtime.state.linkFavorites.leagues.Dawn));
            })();
            """
        )

        self.assertEqual(result["rootLinkIds"], ["folder-link"])
        self.assertEqual(result["folderLinkIds"], {"folder-b": []})
        self.assertIsNone(result["links"][0]["folderId"])

    def test_link_favorites_render_on_a_league_search_root_without_a_query_id(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify(hooks.runtime.ui.linkFavoritesList.children.map((child) => child.className)));
            """
        )

        self.assertEqual(
            result,
            [
                "poe2-marketwright-link-favorite-folder-top-drop-area",
                "poe2-marketwright-link-favorite-group",
                "poe2-marketwright-link-favorite-root",
            ],
        )

    def test_collapsing_all_link_favorite_folders_updates_every_folder(self) -> None:
        result = self.run_node(
            r"""
            (async () => {
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify(hooks.runtime.state.linkFavorites.leagues.Dawn.folders.map((folder) => folder.collapsed)));
            })();
            """
        )

        self.assertEqual(result, [True, True])

    def test_link_favorite_undo_control_resides_in_header_feedback(self) -> None:
        source = (REPO_ROOT / "content.js").read_text(encoding="utf-8")

        self.assertIn('id="poe2-marketwright-link-favorites-feedback-undo"', source)
        self.assertNotIn('id="poe2-marketwright-link-favorites-undo"', source)

    def test_favorites_disclosure_uses_the_full_feature_row_and_keeps_its_switch_independent(self) -> None:
        result = self.run_node(
            r"""
            const fs = require("fs");
            const vm = require("vm");

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
            console.log(JSON.stringify({
              hasDisclosure: originalSource.includes("poe2-marketwright-favorites-disclosure"),
              hasLegacyArrow: originalSource.includes("poe2-marketwright-favorites-toggle"),
              enabled,
              disabled: disclosure.disabled
            }));
            """
        )

        self.assertEqual(
            result,
            {
                "hasDisclosure": True,
                "hasLegacyArrow": False,
                "enabled": {"expanded": "true", "disabled": False, "openClass": True},
                "disabled": True,
            },
        )


if __name__ == "__main__":
    unittest.main()
