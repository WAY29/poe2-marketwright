import json
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class FavoritesFullViewBehaviorTests(unittest.TestCase):
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

    def test_full_view_defaults_to_compact_and_migrates_the_open_item_drawer(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({
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
            }));
            })();
            ''',
        )

        self.assertEqual(
            result,
            {
                "defaultsToCompact": True,
                "fullPanelOpen": True,
                "fullPanelTab": "items",
                "drawersClosed": True,
                "compactDrawerRestored": True,
                "compactPanelClosed": True,
                "fullModeButtonsSynced": True,
            },
        )

    def test_background_relays_panel_requests_only_to_the_registered_trade_tab(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({ registration, relayed, rejected, tabMessages }));
            })();
            ''',
        )

        self.assertEqual(result["registration"], {"ok": True})
        self.assertEqual(result["relayed"], {"ok": True, "state": {"favoritesViewMode": "full"}})
        self.assertEqual(result["rejected"], {"ok": False, "error": "unknown_panel_session"})
        self.assertEqual(
            result["tabMessages"],
            [
                {
                    "tabId": 37,
                    "message": {
                        "type": "favorites-panel-command",
                        "sessionId": "panel-session-1",
                        "command": "get-state",
                    },
                }
            ],
        )

    def test_full_view_toggles_only_the_current_document_panel(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({ hiddenAfterModeChange, visibleAfterOpen, documentLayoutUnchanged, hiddenAfterClose: panelFrame.hidden }));
            })();
            ''',
        )

        self.assertEqual(
            result,
            {
                "hiddenAfterModeChange": True,
                "visibleAfterOpen": True,
                "documentLayoutUnchanged": True,
                "hiddenAfterClose": True,
            },
        )

    def test_clicking_the_open_full_view_section_closes_the_side_panel(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({ state: hooks.runtime.state }));
            })();
            ''',
        )

        self.assertFalse(result["state"]["favoritesPanelOpen"])

    def test_saving_a_link_captures_active_advanced_filter_groups(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
            const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
            let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
            source = source.replace(
              /\n\}\)\(\);\s*$/,
              "\n  window.__testHooks = { getCurrentLinkFavoriteFilterGroups };\n})();"
            );
            const label = (textContent) => ({ textContent });
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
            const field = (name, selects = [], inputs = []) => ({
              matches(selector) { return selector === ".filter, .filter-property"; },
              querySelector(selector) { return selector === ".filter-title" ? label(name) : null; },
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
            const groups = [
              group("Type Filters", [field("Item Category", [select("Bow")])]),
              group("Item Requirements", [field("Item Level", [], [input("80", "Min")])]),
              group("Equipment Filters", [field("Corrupted", [], [checkbox()])]),
              group("Stat Filters", [field("+# to maximum Life", [], [input("50", "Min")])]),
              group("Trade Filters", [field("Indexed", [select("Yes")])])
            ];
            const sandbox = {
              window: { addEventListener() {} },
              document: { querySelectorAll() { return groups; } },
              location: { pathname: "/trade2", href: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1" },
              Poe2MarketwrightFavorites: {
                createLinkFavoriteTools() {
                  return { normalizeLinkFavoriteFilterGroups: (value) => value };
                }
              },
              console
            };
            vm.runInNewContext(source, sandbox, { filename: "content.js" });
            console.log(JSON.stringify(sandbox.window.__testHooks.getCurrentLinkFavoriteFilterGroups()));
            ''',
        )

        self.assertEqual(
            result,
            [
                {"label": "Type Filters", "values": ["Item Category: Bow"]},
                {"label": "Item Requirements", "values": ["Item Level: Min 80"]},
                {"label": "Equipment Filters", "values": ["Corrupted"]},
                {"label": "Stat Filters", "values": ["+# to maximum Life: Min 50"]},
            ],
        )

    def test_link_tooltip_groups_include_every_saved_filter(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify(sandbox.window.__testHooks.getLinkFavoriteTooltipGroups({
              url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
              filterGroups: [
                { label: "Type Filters", values: ["Item Category: Ring"] },
                { label: "Other", values: ["Fractured: Yes"] },
                { label: "Stat Filters", values: ["+# to maximum Life", "+#% Fire Resistance"] }
              ]
            })));
            ''',
        )

        self.assertEqual(
            result,
            [
                {"label": "Type Filters", "values": [{"text": "Item Category: Ring", "source": None}]},
                {"label": "Other", "values": [{"text": "Fractured: Yes", "source": None}]},
                {
                    "label": "Stat Filters",
                    "values": [
                        {"text": "formatted +# to maximum Life", "source": None},
                        {"text": "formatted +#% Fire Resistance", "source": None},
                    ],
                },
            ],
        )
        self.assertIn('id="favorites-panel-tooltip"', (REPO_ROOT / "favorites-panel.html").read_text())

    def test_link_tooltip_prefers_above_the_pointer_and_flips_below_at_the_top_edge(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({
              above: position({ x: 160, y: 500 }, { width: 300, height: 180 }, { width: 360, height: 800 }),
              below: position({ x: 160, y: 50 }, { width: 300, height: 180 }, { width: 360, height: 800 })
            }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "above": {"left": 10, "top": 308, "placement": "above", "arrowX": 150},
                "below": {"left": 10, "top": 62, "placement": "below", "arrowX": 150},
            },
        )

    def test_compact_link_favorite_uses_the_same_stat_summary_and_tooltip_groups(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify(sandbox.window.__testHooks.getCompactLinkFavoritePresentation({
              filterGroups: [
                { label: "Type Filters", values: ["Item Category: Ring"] },
                { label: "Stat Filters", values: ["FRACTURED +#% to Item Rarity", "+# to maximum Life"] }
              ]
            })));
            ''',
        )

        self.assertEqual(
            result,
            {
                "stats": [
                    {"text": "+18% to Item Rarity", "source": {"key": "fractured", "label": "FRACTURED"}},
                    {"text": "formatted +# to maximum Life", "source": None},
                ],
                "tooltipGroups": [
                    {"label": "Type Filters", "values": [{"text": "Item Category: Ring", "source": None}]},
                    {
                        "label": "Stat Filters",
                        "values": [
                            {"text": "+18% to Item Rarity", "source": {"key": "fractured", "label": "FRACTURED"}},
                            {"text": "formatted +# to maximum Life", "source": None},
                        ],
                    },
                ],
            },
        )

    def test_compact_item_favorite_tooltip_includes_context_and_every_modifier(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify(sandbox.window.__testHooks.getCompactFavoritePresentation({
              rarity: "rare",
              displayName: "Storm Ward",
              originalName: "Storm Ward",
              baseName: "Rider Bow",
              itemType: "Bow",
              mods: [
                { text: "+60 to maximum Life" },
                { text: "40% increased Physical Damage", source: "desecrated" }
              ]
            })));
            ''',
        )

        self.assertEqual(
            result,
            {
                "stats": [
                    {"text": "+60 to maximum Life", "source": None},
                    {
                        "text": "40% increased Physical Damage",
                        "source": {"key": "desecrated", "label": "DESECRATED"},
                    },
                ],
                "tooltipGroups": [
                    {
                        "label": "Item",
                        "values": [
                            {"text": "Rarity: RARE", "source": None},
                            {"text": "Storm Ward", "source": None},
                            {"text": "Rider Bow", "source": None},
                            {"text": "Bow", "source": None},
                        ],
                    },
                    {
                        "label": "Modifiers",
                        "values": [
                            {"text": "+60 to maximum Life", "source": None},
                            {
                                "text": "40% increased Physical Damage",
                                "source": {"key": "desecrated", "label": "DESECRATED"},
                            },
                        ],
                    },
                ],
            },
        )

    def test_full_item_favorite_uses_custom_tooltip_groups(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify(sandbox.window.__testHooks.getFavoriteTooltipLink({
              rarity: "rare",
              displayName: "Storm Ward",
              originalName: "Storm Ward",
              baseName: "Rider Bow",
              itemType: "Bow",
              mods: [
                { text: "+60 to maximum Life" },
                { text: "40% increased Physical Damage", source: "desecrated" }
              ]
            })));
            ''',
        )

        self.assertEqual(
            result,
            {
                "filterGroups": [
                    {"label": "Item", "values": ["Rarity: RARE", "Storm Ward", "Rider Bow", "Bow"]},
                    {
                        "label": "Modifiers",
                        "values": [
                            "+60 to maximum Life",
                            {
                                "text": "40% increased Physical Damage",
                                "source": {"key": "desecrated", "label": "DESECRATED"},
                            },
                        ],
                    },
                ]
            },
        )

    def test_full_view_drag_handles_publish_a_recoverable_drag_source(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({
              draggable: element.draggable,
              draggableAttribute: attributes.draggable,
              source: JSON.parse(data["application/x-poe2-marketwright-favorite-drag"]),
              effectAllowed: transfer.effectAllowed,
              classes
            }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "draggable": True,
                "draggableAttribute": "true",
                "source": {"kind": "link", "id": "link-1", "folderId": "folder-1"},
                "effectAllowed": "move",
                "classes": ["favorites-panel-dragging"],
            },
        )

    def test_full_view_drop_recovers_the_drag_source_from_data_transfer(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify(sandbox.window.__testHooks.getFavoritePanelDragSource({
              dataTransfer: {
                getData(type) {
                  return type === "application/x-poe2-marketwright-favorite-drag"
                    ? JSON.stringify(sourceValue)
                    : "";
                }
              }
            })));
            ''',
        )

        self.assertEqual(result, {"kind": "link", "id": "link-1", "folderId": "folder-1"})

    def test_full_view_drag_targets_show_insert_position_and_accept_top_level_links(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
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
            console.log(JSON.stringify({
              rowPrevented,
              rowPosition: rowTarget.dataset.dropPosition,
              rowHighlighted: rowTarget.classList.contains("favorites-panel-drop-target"),
              rootPrevented,
              rootHighlighted: rootTarget.classList.contains("favorites-panel-drop-target"),
              folderTopPrevented,
              folderTopPosition: folderTopTarget.dataset.dropPosition,
              folderTopHighlighted: folderTopTarget.classList.contains("favorites-panel-drop-target")
            }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "rowPrevented": True,
                "rowPosition": "after",
                "rowHighlighted": True,
                "rootPrevented": True,
                "rootHighlighted": True,
                "folderTopPrevented": True,
                "folderTopPosition": "before",
                "folderTopHighlighted": True,
            },
        )

if __name__ == "__main__":
    unittest.main()
