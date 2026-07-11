"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runScript } = require("./helpers/run-script");

test("builds a saved query from trade mod hashes", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
            const favorite = tools.createFavoriteRecord({
              rarity: "Rare",
              name: "Storm Ward",
              typeLine: "Rider Bow",
              explicitMods: [
                { description: "+60 to [Life|maximum Life]", hash: "stat.explicit.stat_3299347043" },
                { description: "Adds 12 to 24 [Fire|Fire] Damage", hash: "stat.explicit.stat_709508406" },
                { description: "Adds 14 to 26 [Fire|Fire] Damage", hash: "stat.explicit.stat_709508406" },
                {
                  description: "Leeches 7% of Physical Damage as Life",
                  hash: "stat.desecrated.stat_55876295"
                }
              ],
              fracturedMods: [
                { description: "+20 to [Dexterity|Dexterity]", hash: "stat.fractured.stat_3261801346" }
              ],
              craftedMods: [
                { description: "Cannot be [Shock|Shocked]", hash: "stat.crafted.stat_491899612" }
              ],
              implicitMods: [
                { description: "+30 to [Spirit|Spirit]", hash: "stat.implicit.stat_0000000001" }
              ]
            }, "Dawn of the Hunt", {
              baseName: "Rider Bow",
              category: "weapon.bow",
              itemType: "Bow"
            }, 123);
            const payload = tools.createTradeSearchPayload(favorite);

            console.log(JSON.stringify({ favorite, payload }));
            `);
  assert.deepStrictEqual(result["favorite"]["league"], "Dawn of the Hunt");
  assert.deepStrictEqual(result["favorite"]["displayName"], "Storm Ward");
  assert.deepStrictEqual(result["favorite"]["rarity"], "rare");
  assert.deepStrictEqual(result["favorite"]["baseName"], "Rider Bow");
  assert.deepStrictEqual(result["favorite"]["category"], "weapon.bow");
  assert.deepStrictEqual(result["favorite"]["itemType"], "Bow");
  assert.equal(result["favorite"]["approximate"], true);
  assert.deepStrictEqual(result["favorite"]["stats"], [{"id": "explicit.stat_3299347043", "value": {"min": 60, "max": 60}}, {"id": "explicit.stat_709508406", "value": {"min": 38, "max": 38}}, {"id": "desecrated.stat_55876295", "value": {"min": 7, "max": 7}}, {"id": "fractured.stat_3261801346", "value": {"min": 20, "max": 20}}, {"id": "crafted.stat_491899612"}]);
  assert.deepStrictEqual((result["favorite"]["mods"]).length, 6);
  assert.deepStrictEqual(result["favorite"]["mods"], [{"id": "explicit.stat_3299347043", "text": "+60 to maximum Life", "source": "explicit"}, {"id": "explicit.stat_709508406", "text": "Adds 12 to 24 Fire Damage", "source": "explicit"}, {"id": "explicit.stat_709508406", "text": "Adds 14 to 26 Fire Damage", "source": "explicit"}, {"id": "desecrated.stat_55876295", "text": "Leeches 7% of Physical Damage as Life", "source": "desecrated"}, {"id": "fractured.stat_3261801346", "text": "+20 to Dexterity", "source": "fractured"}, {"id": "crafted.stat_491899612", "text": "Cannot be Shocked", "source": "crafted"}]);
  assert.deepStrictEqual(result["payload"], {"query": {"status": {"option": "available"}, "type": "Rider Bow", "stats": [{"type": "and", "filters": [{"id": "explicit.stat_3299347043", "value": {"min": 60, "max": 60}, "disabled": false}, {"id": "explicit.stat_709508406", "value": {"min": 38, "max": 38}, "disabled": false}, {"id": "desecrated.stat_55876295", "value": {"min": 7, "max": 7}, "disabled": false}, {"id": "fractured.stat_3261801346", "value": {"min": 20, "max": 20}, "disabled": false}, {"id": "crafted.stat_491899612", "disabled": false}]}], "filters": {"type_filters": {"filters": {"rarity": {"option": "rare"}, "category": {"option": "weapon.bow"}}}, "misc_filters": {"filters": {"fractured_item": {"option": "true"}, "desecrated": {"option": "true"}}}}}, "sort": {"price": "asc"}});
});

test("uses base name and category instead of the random item name", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
            const unique = tools.createFavoriteRecord({
              rarity: "Unique",
              name: "Howlcrack",
              typeLine: "Fur Plate",
              explicitMods: [{ description: "Cannot be [Shock|Shocked]", hash: "stat.explicit.stat_491899612" }]
            }, "HC Dawn", {
              baseName: "Fur Plate",
              category: "armour.chest",
              itemType: "Body Armour"
            }, 456);
            console.log(JSON.stringify({
              baseName: unique.baseName,
              itemType: unique.itemType,
              queryName: tools.createTradeSearchPayload(unique).query.name || null,
              queryType: tools.createTradeSearchPayload(unique).query.type,
              category: tools.createTradeSearchPayload(unique).query.filters.type_filters.filters.category.option,
              league: tools.getLeagueFromTradeUrl(
                "https://www.pathofexile.com/trade2/search/poe2/HC%20Dawn/query-1"
              )
            }));
            `);
  assert.deepStrictEqual(result, {"baseName": "Fur Plate", "itemType": "Body Armour", "queryName": null, "queryType": "Fur Plate", "category": "armour.chest", "league": "HC Dawn"});
});

test("combines special source values into normal stat without affix count pseudos", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
            const favorite = tools.createFavoriteRecord({
              rarity: "Rare",
              name: "Bramble Roar",
              typeLine: "Ruination Maul",
              explicitMods: [
                { description: "70% increased Physical Damage", hash: "stat.explicit.stat_1509134228" },
                { description: "+161 to Accuracy Rating", hash: "stat.explicit.stat_691932474" },
                {
                  description: "Gain 27 Mana per enemy killed",
                  hash: "stat.explicit.stat_1368271171"
                }
              ],
              fracturedMods: [
                { description: "178% increased Physical Damage", hash: "stat.fractured.stat_1509134228" }
              ]
            }, "Dawn of the Hunt", {
              baseName: "Ruination Maul",
              category: "weapon.twomace",
              itemType: "Two-Handed Mace"
            }, 789);
            const payload = tools.createTradeSearchPayload(favorite);
            console.log(JSON.stringify(payload.query.stats[0].filters));
            `);
  assert.deepStrictEqual(result, [{"id": "explicit.stat_1509134228", "value": {"min": 248, "max": 248}, "disabled": false}, {"id": "explicit.stat_691932474", "value": {"min": 161, "max": 161}, "disabled": false}, {"id": "explicit.stat_1368271171", "value": {"min": 27, "max": 27}, "disabled": false}, {"id": "fractured.stat_1509134228", "value": {"min": 178, "max": 178}, "disabled": false}]);
});

test("combines desecrated value into matching normal stat", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
            const favorite = tools.createFavoriteRecord({
              rarity: "Rare",
              name: "Bramble Roar",
              typeLine: "Ruination Maul",
              explicitMods: [
                { description: "70% increased Physical Damage", hash: "stat.explicit.stat_1509134228" }
              ],
              desecratedMods: [
                { description: "4% increased Physical Damage", hash: "stat.desecrated.stat_1509134228" }
              ]
            }, "Dawn of the Hunt", {
              baseName: "Ruination Maul",
              category: "weapon.twomace",
              itemType: "Two-Handed Mace"
            }, 790);
            console.log(JSON.stringify(favorite.stats));
            `);
  assert.deepStrictEqual(result, [{"id": "explicit.stat_1509134228", "value": {"min": 74, "max": 74}}, {"id": "desecrated.stat_1509134228", "value": {"min": 4, "max": 4}}]);
});

test("page bridge forwards trade fetch when favorites are enabled", async () => {
  const result = await runScript(`
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            const listeners = [];
            const messages = [];
            const window = {
              app: { $data: { static_: { knownStats: [] } } },
              addEventListener(type, listener) {
                if (type === "message") listeners.push(listener);
              },
              postMessage(message) {
                messages.push(message);
              },
              fetch() {
                return Promise.resolve({
                  clone() {
                    return { text: () => Promise.resolve('{"result":[{"id":"item-1","item":{}}]}') };
                  }
                });
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
                payload: { enabled: false }
              }
            });
            await window.fetch("/api/trade2/fetch/item-1?query=query-1");
            await new Promise((resolve) => setTimeout(resolve, 0));
            console.log(JSON.stringify(messages.filter((message) => message.source === "poe2-marketwright-favorites")));
            })();
            `);
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright-favorites", "url": "/api/trade2/fetch/item-1?query=query-1", "body": "{\"result\":[{\"id\":\"item-1\",\"item\":{}}]}"}]);
});

test("link favorite tools validate and create current trade search records", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console, URL };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
            const record = tools.createLinkFavoriteRecord({
              url: "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-7?ignored=value#anchor",
              displayName: "Warmonger Bow",
              folderId: "folder-1",
              id: "link-1",
              createdAt: 123,
              filterGroups: [
                { label: "Type Filters", values: ["Bow", " Rare ", "Bow"] },
                { label: "Stat Filters", values: ["+# to maximum Life", ""] },
                { label: "", values: ["ignored"] }
              ]
            });
            let invalidCode = null;
            try {
              tools.validateTradeSearchUrl("https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt");
            } catch (error) {
              invalidCode = error.code;
            }

            console.log(JSON.stringify({ record, invalidCode }));
            `);
  assert.deepStrictEqual(result, {"record": {"id": "link-1", "league": "Dawn of the Hunt", "queryId": "query-7", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-7", "displayName": "Warmonger Bow", "folderId": "folder-1", "createdAt": 123, "lastUsedAt": null, "filterGroups": [{"label": "Type Filters", "values": ["Bow", "Rare"]}, {"label": "Stat Filters", "values": ["+# to maximum Life"]}]}, "invalidCode": "invalid_trade_search_url"});
});

test("link favorite keeps a bounded official query display snapshot", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console, URL };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });
            const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
            const record = tools.createLinkFavoriteRecord({
              url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-7",
              displayName: "Bow search",
              displaySnapshot: {
                type: "Rider Bow",
                category: "weapon.bow",
                rarity: "rare",
                stats: [
                  { id: "explicit.stat_3299347043", value: { min: 50, max: 80 } },
                  { id: "not-a-trade-stat", value: { min: 1 } }
                ]
              }
            });
            console.log(JSON.stringify(record.displaySnapshot));
            `);
  assert.deepStrictEqual(result, {"type": "Rider Bow", "category": "weapon.bow", "rarity": "rare", "stats": [{"id": "explicit.stat_3299347043", "value": {"min": 50, "max": 80}}]});
});

test("page bridge forwards trade search request and query id for link snapshots", async () => {
  const result = await runScript(`
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            const listeners = [];
            const messages = [];
            const window = {
              app: { $data: { static_: { knownStats: [] } } },
              addEventListener(type, listener) { if (type === "message") listeners.push(listener); },
              postMessage(message) { messages.push(message); },
              fetch(url) {
                return Promise.resolve({
                  clone() { return { text: () => Promise.resolve('{"id":"query-7"}') }; }
                });
              }
            };
            vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), { window, console }, {
              filename: "page-bridge.js"
            });
            listeners[0]({
              source: window,
              data: { source: "poe2-marketwright", type: "POE2_MARKETWRIGHT_UPDATE", payload: { favoritesEnabled: true } }
            });
            const query = {
              query: {
                type: "Rider Bow",
                stats: [{ filters: [{ id: "explicit.stat_3299347043", value: { min: 50 } }] }]
              }
            };
            await window.fetch("/api/trade2/search/Dawn", { method: "POST", body: JSON.stringify(query) });
            await new Promise((resolve) => setTimeout(resolve, 0));
            console.log(JSON.stringify(messages.filter((message) => message.type === "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT")));
            })();
            `);
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright", "type": "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT", "payload": {"league": "Dawn", "queryId": "query-7", "query": {"query": {"type": "Rider Bow", "stats": [{"filters": [{"id": "explicit.stat_3299347043", "value": {"min": 50}}]}]}}}}]);
});

test("link favorite stat summary removes random prefixes and formats special sources", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console, URL };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
            console.log(JSON.stringify({
              regular: tools.formatLinkFavoriteStatFilter(
                "隨機屬性 攻擊附加#至#冰冷傷害[Adds # to # Cold damage to Attacks]:最小40.5/最大40.5"
              ),
              special: tools.formatLinkFavoriteStatFilter(
                "FRACTURED +#% to Item Rarity: Min 18 / Max 18"
              )
            }));
            `);
  assert.deepStrictEqual(result, {"regular": {"text": "攻擊附加40.5至40.5冰冷傷害", "source": null}, "special": {"text": "+18% to Item Rarity", "source": {"key": "fractured", "label": "FRACTURED"}}});
});

test("link favorite state migrates independently and removes stale folder references", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console, URL };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
            const state = tools.normalizeLinkFavoritesState({
              version: 0,
              folders: [
                { id: "folder-1", league: "Dawn", name: "Bows", createdAt: 10 },
                { id: "folder-2", league: "Dawn", name: "Axes", createdAt: 11 }
              ],
              links: [
                {
                  id: "link-1",
                  league: "Dawn",
                  queryId: "query-1",
                  url: "https://pathofexile.com/trade2/search/poe2/Dawn/query-1",
                  displayName: "Warmonger Bow",
                  folderId: "folder-1",
                  createdAt: 20,
                  lastUsedAt: 30
                },
                {
                  id: "link-2",
                  league: "Dawn",
                  queryId: "query-2",
                  url: "https://pathofexile.com/trade2/search/poe2/Dawn/query-2",
                  displayName: "Unfiled",
                  folderId: "missing-folder",
                  createdAt: 21
                }
              ],
              folderOrder: ["folder-2", "folder-1", "unknown-folder"],
              rootLinkIds: ["link-2", "unknown-link"],
              folderLinkIds: { "folder-1": ["link-1", "unknown-link"] }
            });

            console.log(JSON.stringify(state));
            `);
  assert.deepStrictEqual(result, {"version": 2, "leagues": {"Dawn": {"folders": [{"id": "folder-1", "name": "Bows", "createdAt": 10, "collapsed": false}, {"id": "folder-2", "name": "Axes", "createdAt": 11, "collapsed": false}], "folderOrder": ["folder-2", "folder-1"], "links": [{"id": "link-1", "league": "Dawn", "queryId": "query-1", "url": "https://pathofexile.com/trade2/search/poe2/Dawn/query-1", "displayName": "Warmonger Bow", "folderId": "folder-1", "createdAt": 20, "lastUsedAt": 30}, {"id": "link-2", "league": "Dawn", "queryId": "query-2", "url": "https://pathofexile.com/trade2/search/poe2/Dawn/query-2", "displayName": "Unfiled", "folderId": null, "createdAt": 21, "lastUsedAt": null}], "rootLinkIds": ["link-2"], "folderLinkIds": {"folder-1": ["link-1"], "folder-2": []}}}});
});

test("imports external link bookmarks into the selected league idempotently", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console, URL };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
            const source = {
              folders: [
                {
                  id: "later-folder",
                  index: 1,
                  name: "Bows",
                  isOpen: false,
                  bookmarks: [
                    { id: "bow-later", name: "Late bow", poeVersion: "Poe2", type: "search", endpoint: "query-later", idx: 1 },
                    { id: "bow-first", name: "First bow", poeVersion: "Poe2", type: "search", endpoint: "query-first", idx: 0 },
                    { id: "poe1", name: "Skip", poeVersion: "Poe1", type: "search", endpoint: "skip", idx: 2 }
                  ]
                },
                {
                  id: "first-folder",
                  index: 0,
                  name: "Helmets",
                  isOpen: true,
                  bookmarks: [
                    { id: "helm", name: "Helm", poeVersion: "Poe2", type: "search", endpoint: "query-helm", idx: 0 }
                  ]
                }
              ]
            };
            const first = tools.importExternalLinkFavorites({}, source, "Dawn of the Hunt", 123);
            const second = tools.importExternalLinkFavorites(first.state, source, "Dawn of the Hunt", 456);
            const league = first.state.leagues["Dawn of the Hunt"];
            console.log(JSON.stringify({
              first: {
                importedFolders: first.importedFolders,
                importedLinks: first.importedLinks,
                skippedLinks: first.skippedLinks,
                folderOrder: league.folderOrder,
                folders: league.folders,
                links: league.links,
                folderLinkIds: league.folderLinkIds
              },
              second: {
                importedFolders: second.importedFolders,
                importedLinks: second.importedLinks,
                skippedLinks: second.skippedLinks
              }
            }));
            `);
  assert.deepStrictEqual(result, {"first": {"importedFolders": 2, "importedLinks": 3, "skippedLinks": 1, "folderOrder": ["import-folder-first-folder", "import-folder-later-folder"], "folders": [{"id": "import-folder-first-folder", "name": "Helmets", "createdAt": 123, "collapsed": false}, {"id": "import-folder-later-folder", "name": "Bows", "createdAt": 123, "collapsed": true}], "links": [{"id": "import-link-helm", "league": "Dawn of the Hunt", "queryId": "query-helm", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-helm", "displayName": "Helm", "folderId": "import-folder-first-folder", "createdAt": 123, "lastUsedAt": null}, {"id": "import-link-bow-first", "league": "Dawn of the Hunt", "queryId": "query-first", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-first", "displayName": "First bow", "folderId": "import-folder-later-folder", "createdAt": 123, "lastUsedAt": null}, {"id": "import-link-bow-later", "league": "Dawn of the Hunt", "queryId": "query-later", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-later", "displayName": "Late bow", "folderId": "import-folder-later-folder", "createdAt": 123, "lastUsedAt": null}], "folderLinkIds": {"import-folder-first-folder": ["import-link-helm"], "import-folder-later-folder": ["import-link-bow-first", "import-link-bow-later"]}}, "second": {"importedFolders": 0, "importedLinks": 0, "skippedLinks": 4}});
});

test("exports compatible bookmark json and round trips root bookmarks", async () => {
  const result = await runScript(`
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console, URL };
            vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
              filename: "favorites.js"
            });

            const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
            const state = tools.normalizeLinkFavoritesState({
              version: 1,
              leagues: {
                Dawn: {
                  folders: [
                    { id: "folder-bows", name: "Bows", createdAt: 10, collapsed: true },
                    { id: "folder-helms", name: "Helmets", createdAt: 11, collapsed: false }
                  ],
                  folderOrder: ["folder-helms", "folder-bows"],
                  links: [
                    {
                      id: "link-bow",
                      url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-bow",
                      displayName: "Bow",
                      folderId: "folder-bows",
                      createdAt: 20
                    },
                    {
                      id: "link-root",
                      url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-root",
                      displayName: "Root search",
                      folderId: null,
                      createdAt: 21
                    },
                    {
                      id: "link-helm",
                      url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-helm",
                      displayName: "Helm",
                      folderId: "folder-helms",
                      createdAt: 22
                    }
                  ],
                  rootLinkIds: ["link-root"],
                  folderLinkIds: {
                    "folder-bows": ["link-bow"],
                    "folder-helms": ["link-helm"]
                  }
                }
              }
            });
            const exported = tools.exportExternalLinkFavorites(state, "Dawn");
            const restored = tools.importExternalLinkFavorites({}, exported, "Dawn", 30).state.leagues.Dawn;
            console.log(JSON.stringify({ exported, restored }));
            `);
  assert.deepStrictEqual(result, {"exported": {"folders": [{"id": "folder-helms", "childIds": [], "parentId": null, "depth": 0, "index": 0, "name": "Helmets", "bookmarks": [{"id": "link-helm", "name": "Helm", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-helm", "type": "search", "idx": 0, "isDone": true}], "isOpen": true}, {"id": "folder-bows", "childIds": [], "parentId": null, "depth": 0, "index": 1, "name": "Bows", "bookmarks": [{"id": "link-bow", "name": "Bow", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-bow", "type": "search", "idx": 0, "isDone": true}], "isOpen": false}], "rootBookmarks": [{"id": "link-root", "name": "Root search", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-root", "type": "search", "idx": 0, "isDone": true}]}, "restored": {"folders": [{"id": "import-folder-folder-helms", "name": "Helmets", "createdAt": 30, "collapsed": false}, {"id": "import-folder-folder-bows", "name": "Bows", "createdAt": 30, "collapsed": true}], "folderOrder": ["import-folder-folder-helms", "import-folder-folder-bows"], "links": [{"id": "import-link-link-helm", "league": "Dawn", "queryId": "query-helm", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-helm", "displayName": "Helm", "folderId": "import-folder-folder-helms", "createdAt": 30, "lastUsedAt": null}, {"id": "import-link-link-bow", "league": "Dawn", "queryId": "query-bow", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-bow", "displayName": "Bow", "folderId": "import-folder-folder-bows", "createdAt": 30, "lastUsedAt": null}, {"id": "import-link-link-root", "league": "Dawn", "queryId": "query-root", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-root", "displayName": "Root search", "folderId": null, "createdAt": 30, "lastUsedAt": null}], "rootLinkIds": ["import-link-link-root"], "folderLinkIds": {"import-folder-folder-helms": ["import-link-link-helm"], "import-folder-folder-bows": ["import-link-link-bow"]}}});
});
