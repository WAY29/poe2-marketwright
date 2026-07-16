"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

function loadContentHooks(hookNames, { storedState = {}, onSet } = {}) {
  const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
  let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
  source = source.replace(
    /\n\}\)\(\);\s*$/,
    `\n  window.__testHooks = { ${hookNames.join(", ")} };\n})();`
  );

  let current = structuredClone(storedState);
  const listeners = [];
  const sandbox = {
    window: {
      addEventListener() {},
      innerWidth: 1280,
      innerHeight: 900,
      __poe2Trade2AffixFilterLoaded: false
    },
    document: {
      querySelector() {
        return null;
      },
      createElement() {
        return {
          style: {},
          classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
          setAttribute() {},
          append() {},
          appendChild() {},
          addEventListener() {},
          querySelector() { return null; },
          querySelectorAll() { return []; }
        };
      }
    },
    location: { pathname: "/trade2", href: "https://www.pathofexile.com/trade2/search/poe2/Standard" },
    console,
    chrome: {
      storage: {
        local: {
          async get(key) {
            return { [key]: structuredClone(current) };
          },
          async set(values) {
            const next = values.poe2Trade2AffixFilterState;
            const change = {
              poe2Trade2AffixFilterState: {
                oldValue: structuredClone(current),
                newValue: structuredClone(next)
              }
            };
            current = structuredClone(next);
            if (onSet) {
              onSet(structuredClone(current));
            }
            for (const listener of listeners) {
              listener(change, "local");
            }
          }
        },
        onChanged: {
          addListener(listener) {
            listeners.push(listener);
          }
        }
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  return {
    hooks: sandbox.window.__testHooks,
    getStored: () => structuredClone(current),
    emitExternalChange(nextState) {
      const change = {
        poe2Trade2AffixFilterState: {
          oldValue: structuredClone(current),
          newValue: structuredClone(nextState)
        }
      };
      current = structuredClone(nextState);
      for (const listener of listeners) {
        listener(change, "local");
      }
    }
  };
}

test("ui saveState keeps newer favorite data already on disk", async () => {
  const diskFavorites = [{ signature: "sig-a", league: "Standard", displayName: "A" }];
  const diskFolders = {
    version: 1,
    leagues: {
      Standard: {
        folders: [{ id: "folder-1", name: "Kept", createdAt: 1, collapsed: false }],
        folderOrder: ["folder-1"],
        rootFavoriteSignatures: ["sig-a"],
        folderFavoriteSignatures: { "folder-1": [] }
      }
    }
  };
  const diskLinks = {
    version: 2,
    leagues: {
      Standard: {
        folders: [],
        folderOrder: [],
        links: [{ id: "link-1", displayName: "Search", league: "Standard", queryId: "abc" }],
        rootLinkIds: ["link-1"],
        folderLinkIds: {}
      }
    }
  };

  const { hooks, getStored } = loadContentHooks(["saveState", "runtime"], {
    storedState: {
      filteringEnabled: true,
      favorites: diskFavorites,
      favoriteFolders: diskFolders,
      linkFavorites: diskLinks
    }
  });

  hooks.runtime.state = {
    filteringEnabled: false,
    favorites: [],
    favoriteFolders: { version: 1, leagues: {} },
    linkFavorites: { version: 2, leagues: {} },
    favoritesEnabled: true,
    linkFavoritesEnabled: true
  };

  await hooks.saveState();
  const stored = getStored();
  assert.equal(stored.filteringEnabled, false);
  assert.deepStrictEqual(stored.favorites, diskFavorites);
  assert.deepStrictEqual(stored.favoriteFolders, diskFolders);
  assert.deepStrictEqual(stored.linkFavorites, diskLinks);
});

test("favoriteKeys save only updates the mutated favorite payload", async () => {
  const { hooks, getStored } = loadContentHooks(["saveState", "runtime"], {
    storedState: {
      filteringEnabled: true,
      favorites: [{ signature: "old", league: "Standard" }],
      favoriteFolders: { version: 1, leagues: {} },
      linkFavorites: {
        version: 2,
        leagues: {
          Standard: {
            folders: [{ id: "folder-link", name: "Links", createdAt: 1, collapsed: false }],
            folderOrder: ["folder-link"],
            links: [],
            rootLinkIds: [],
            folderLinkIds: { "folder-link": [] }
          }
        }
      }
    }
  });

  hooks.runtime.state = {
    filteringEnabled: false,
    favorites: [{ signature: "new", league: "Standard" }],
    favoriteFolders: {
      version: 1,
      leagues: {
        Standard: {
          folders: [{ id: "folder-item", name: "Items", createdAt: 2, collapsed: false }],
          folderOrder: ["folder-item"],
          rootFavoriteSignatures: ["new"],
          folderFavoriteSignatures: { "folder-item": [] }
        }
      }
    },
    linkFavorites: { version: 2, leagues: {} },
    favoritesEnabled: true,
    linkFavoritesEnabled: true
  };

  await hooks.saveState({ favoriteKeys: ["favorites", "favoriteFolders"] });
  const stored = getStored();
  assert.equal(stored.filteringEnabled, true, "settings from other tabs stay intact");
  assert.deepStrictEqual(stored.favorites, [{ signature: "new", league: "Standard" }]);
  assert.equal(stored.favoriteFolders.leagues.Standard.folders[0].name, "Items");
  assert.equal(stored.linkFavorites.leagues.Standard.folders[0].name, "Links");
});

test("storage onChanged applies external favorite folder updates", async () => {
  const { hooks, emitExternalChange } = loadContentHooks(
    ["bindFavoriteStorageSync", "applyExternalFavoriteState", "runtime", "getFavoriteDataFingerprint"],
    {
      storedState: {
        favorites: [],
        favoriteFolders: { version: 1, leagues: {} },
        linkFavorites: { version: 2, leagues: {} },
        favoritesEnabled: true,
        linkFavoritesEnabled: true
      }
    }
  );

  const renderCalls = [];
  hooks.runtime.state = {
    favorites: [],
    favoriteFolders: { version: 1, leagues: {} },
    linkFavorites: { version: 2, leagues: {} },
    favoritesEnabled: true,
    linkFavoritesEnabled: true,
    favoritesDrawerOpen: false,
    linkFavoritesDrawerOpen: false
  };
  hooks.runtime.favorites = {
    setFavorites(next) {
      renderCalls.push(["setFavorites", next.length]);
    },
    setEnabled(enabled) {
      renderCalls.push(["setEnabled", enabled]);
    }
  };
  hooks.runtime.ui = {};

  const external = {
    favorites: [{ signature: "from-other-tab", league: "Standard" }],
    favoriteFolders: {
      version: 1,
      leagues: {
        Standard: {
          folders: [{ id: "shared", name: "Shared", createdAt: 3, collapsed: false }],
          folderOrder: ["shared"],
          rootFavoriteSignatures: ["from-other-tab"],
          folderFavoriteSignatures: { shared: [] }
        }
      }
    },
    linkFavorites: {
      version: 2,
      leagues: {
        Standard: {
          folders: [],
          folderOrder: [],
          links: [{ id: "link-x", displayName: "Other tab", league: "Standard", queryId: "xyz" }],
          rootLinkIds: ["link-x"],
          folderLinkIds: {}
        }
      }
    },
    favoritesEnabled: true,
    linkFavoritesEnabled: true
  };

  const changed = hooks.applyExternalFavoriteState(external);
  assert.equal(changed, true);
  assert.equal(hooks.runtime.state.favorites[0].signature, "from-other-tab");
  assert.equal(hooks.runtime.state.favoriteFolders.leagues.Standard.folders[0].name, "Shared");
  assert.equal(hooks.runtime.state.linkFavorites.leagues.Standard.links[0].id, "link-x");
  assert.ok(renderCalls.some((entry) => entry[0] === "setFavorites"));

  // Identical payload is a no-op.
  assert.equal(hooks.applyExternalFavoriteState(external), false);
});
