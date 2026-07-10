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
            },
        )

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
