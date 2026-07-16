"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

test("builds a saved query from trade mod hashes", async () => {
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

  const result = structuredClone({ favorite, payload });
  assert.deepStrictEqual(result["favorite"]["league"], "Dawn of the Hunt");
  assert.deepStrictEqual(result["favorite"]["displayName"], "Storm Ward");
  assert.deepStrictEqual(result["favorite"]["rarity"], "rare");
  assert.deepStrictEqual(result["favorite"]["baseName"], "Rider Bow");
  assert.deepStrictEqual(result["favorite"]["category"], "weapon.bow");
  assert.deepStrictEqual(result["favorite"]["itemType"], "Bow");
  assert.equal(result["favorite"]["approximate"], true);
  assert.deepStrictEqual(result["favorite"]["stats"], [{"id": "explicit.stat_3299347043", "value": {"min": 60, "max": 60}}, {"id": "explicit.stat_709508406", "value": {"min": 38, "max": 38}}, {"id": "desecrated.stat_55876295", "value": {"min": 7, "max": 7}}, {"id": "fractured.stat_3261801346", "value": {"min": 20, "max": 20}}, {"id": "crafted.stat_491899612"}, {"id": "implicit.stat_0000000001", "value": {"min": 30, "max": 30}}]);
  assert.deepStrictEqual((result["favorite"]["mods"]).length, 7);
  assert.deepStrictEqual(result["favorite"]["mods"], [{"id": "explicit.stat_3299347043", "text": "+60 to maximum Life", "source": "explicit"}, {"id": "explicit.stat_709508406", "text": "Adds 12 to 24 Fire Damage", "source": "explicit"}, {"id": "explicit.stat_709508406", "text": "Adds 14 to 26 Fire Damage", "source": "explicit"}, {"id": "desecrated.stat_55876295", "text": "Leeches 7% of Physical Damage as Life", "source": "desecrated"}, {"id": "fractured.stat_3261801346", "text": "+20 to Dexterity", "source": "fractured"}, {"id": "crafted.stat_491899612", "text": "Cannot be Shocked", "source": "crafted"}, {"id": "implicit.stat_0000000001", "text": "+30 to Spirit", "source": "implicit"}]);
  assert.deepStrictEqual(result["payload"], {"query": {"status": {"option": "available"}, "type": "Rider Bow", "stats": [{"type": "and", "filters": [{"id": "explicit.stat_3299347043", "value": {"min": 60, "max": 60}, "disabled": false}, {"id": "explicit.stat_709508406", "value": {"min": 38, "max": 38}, "disabled": false}, {"id": "desecrated.stat_55876295", "value": {"min": 7, "max": 7}, "disabled": false}, {"id": "fractured.stat_3261801346", "value": {"min": 20, "max": 20}, "disabled": false}, {"id": "crafted.stat_491899612", "disabled": false}, {"id": "implicit.stat_0000000001", "value": {"min": 30, "max": 30}, "disabled": false}]}], "filters": {"type_filters": {"filters": {"rarity": {"option": "rare"}, "category": {"option": "weapon.bow"}}}, "misc_filters": {"filters": {"fractured_item": {"option": "true"}, "desecrated": {"option": "true"}}}}}, "sort": {"price": "asc"}});
});

test("uses base name and category instead of the random item name", async () => {
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
  const result = structuredClone({
    baseName: unique.baseName,
    itemType: unique.itemType,
    queryName: tools.createTradeSearchPayload(unique).query.name || null,
    queryType: tools.createTradeSearchPayload(unique).query.type,
    category: tools.createTradeSearchPayload(unique).query.filters.type_filters.filters.category.option,
    league: tools.getLeagueFromTradeUrl(
      "https://www.pathofexile.com/trade2/search/poe2/HC%20Dawn/query-1"
    )
  });
  assert.deepStrictEqual(result, {"baseName": "Fur Plate", "itemType": "Body Armour", "queryName": null, "queryType": "Fur Plate", "category": "armour.chest", "league": "HC Dawn"});
});

test("preserves implicit and special-source stats in saved favorite searches", async () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
  const favorite = tools.createFavoriteRecord({
    rarity: "Rare",
    name: "Dawn Veil",
    typeLine: "Rider Bow",
    implicitMods: [{ description: "+30 to Spirit", hash: "stat.implicit.stat_3917489142" }],
    enchantMods: [{ description: "+20 to Dexterity", hash: "stat.enchant.stat_3261801346" }],
    runeMods: [{ description: "15% increased Armour, Evasion and Energy Shield", hash: "stat.rune.stat_3523867985" }],
    explicitMods: [
      { description: "25% chance to Avoid Resolve loss from Enemy Hits", hash: "stat.sanctum.stat_2878762585" },
      { description: "Grants Skill: Level 12 Mana Drain", hash: "stat.skill.mana_drain" }
    ]
  }, "Runes of Aldur", {
    baseName: "Rider Bow",
    category: "weapon.bow",
    itemType: "Bow"
  }, 123);
  const payload = tools.createTradeSearchPayload(favorite);
  const result = structuredClone({ stats: favorite.stats, mods: favorite.mods, payload });

  assert.deepStrictEqual(result.stats, [{"id": "implicit.stat_3917489142", "value": {"min": 30, "max": 30}}, {"id": "enchant.stat_3261801346", "value": {"min": 20, "max": 20}}, {"id": "rune.stat_3523867985", "value": {"min": 15, "max": 15}}, {"id": "sanctum.stat_2878762585", "value": {"min": 25, "max": 25}}, {"id": "skill.mana_drain", "value": {"min": 12, "max": 12}}]);
  assert.deepStrictEqual(result.mods, [{"id": "implicit.stat_3917489142", "text": "+30 to Spirit", "source": "implicit"}, {"id": "enchant.stat_3261801346", "text": "+20 to Dexterity", "source": "enchant"}, {"id": "rune.stat_3523867985", "text": "15% increased Armour, Evasion and Energy Shield", "source": "rune"}, {"id": "sanctum.stat_2878762585", "text": "25% chance to Avoid Resolve loss from Enemy Hits", "source": "sanctum"}, {"id": "skill.mana_drain", "text": "Grants Skill: Level 12 Mana Drain", "source": "skill"}]);
  assert.deepStrictEqual(result.payload, {"query": {"status": {"option": "available"}, "type": "Rider Bow", "stats": [{"type": "and", "filters": [{"id": "implicit.stat_3917489142", "value": {"min": 30, "max": 30}, "disabled": false}, {"id": "enchant.stat_3261801346", "value": {"min": 20, "max": 20}, "disabled": false}, {"id": "rune.stat_3523867985", "value": {"min": 15, "max": 15}, "disabled": false}, {"id": "sanctum.stat_2878762585", "value": {"min": 25, "max": 25}, "disabled": false}, {"id": "skill.mana_drain", "value": {"min": 12, "max": 12}, "disabled": false}]}], "filters": {"type_filters": {"filters": {"rarity": {"option": "rare"}, "category": {"option": "weapon.bow"}}}}}, "sort": {"price": "asc"}});
});

test("reads rune stats from official extended hashes", async () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
  const favorite = tools.createFavoriteRecord({
    rarity: "Magic",
    typeLine: "Ornate Greaves of the Kiln",
    runeMods: [
      "18% increased [Armour|Armour], [Evasion|Evasion] and [EnergyShield|Energy Shield]",
      "[ShamanOnlyMods|Bonded]: +20 to maximum Life",
      "[ShamanOnlyMods|Bonded]: +20 to maximum Mana"
    ],
    explicitMods: [{ description: "20% increased Armour, Evasion and Energy Shield", hash: "stat.explicit.stat_3523867985" }],
    extended: {
      hashes: {
        rune: [
          ["rune.stat_3523867985", null],
          ["rune.stat_2280525771", null],
          ["rune.stat_2926029365", null]
        ]
      }
    }
  }, "Runes of Aldur", {
    baseName: "Ornate Greaves",
    category: "armour.boots",
    itemType: "Boots"
  }, 123);
  const payload = tools.createTradeSearchPayload(favorite);
  const result = structuredClone({ mods: favorite.mods, stats: favorite.stats, filters: payload.query.stats[0].filters });

  assert.deepStrictEqual(result, {"mods": [{"id": "rune.stat_3523867985", "text": "18% increased Armour, Evasion and Energy Shield", "source": "rune"}, {"id": "rune.stat_2280525771", "text": "Bonded: +20 to maximum Life", "source": "rune"}, {"id": "rune.stat_2926029365", "text": "Bonded: +20 to maximum Mana", "source": "rune"}, {"id": "explicit.stat_3523867985", "text": "20% increased Armour, Evasion and Energy Shield", "source": "explicit"}], "stats": [{"id": "rune.stat_3523867985", "value": {"min": 18, "max": 18}}, {"id": "rune.stat_2280525771", "value": {"min": 20, "max": 20}}, {"id": "rune.stat_2926029365", "value": {"min": 20, "max": 20}}, {"id": "explicit.stat_3523867985", "value": {"min": 20, "max": 20}}], "filters": [{"id": "rune.stat_3523867985", "value": {"min": 18, "max": 18}, "disabled": false}, {"id": "rune.stat_2280525771", "value": {"min": 20, "max": 20}, "disabled": false}, {"id": "rune.stat_2926029365", "value": {"min": 20, "max": 20}, "disabled": false}, {"id": "explicit.stat_3523867985", "value": {"min": 20, "max": 20}, "disabled": false}]});
});

test("reads granted skills from official extended hashes", async () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createFavoriteTools();
  const favorite = tools.createFavoriteRecord({
    rarity: "Rare",
    typeLine: "Shrine Sceptre",
    grantedSkills: [{ name: "Grants Skill", values: [["Level 14 Purity of Fire", 25]] }],
    extended: { hashes: { skill: [["skill.purity_of_fire", null]] } }
  }, "Runes of Aldur", {
    baseName: "Shrine Sceptre",
    category: "weapon.sceptre",
    itemType: "Sceptre"
  }, 123);
  const payload = tools.createTradeSearchPayload(favorite);
  const result = structuredClone({ mods: favorite.mods, stats: favorite.stats, filters: payload.query.stats[0].filters });

  assert.deepStrictEqual(result, {"mods": [{"id": "skill.purity_of_fire", "text": "Grants Skill: Level 14 Purity of Fire", "source": "skill"}], "stats": [{"id": "skill.purity_of_fire", "value": {"min": 14, "max": 14}}], "filters": [{"id": "skill.purity_of_fire", "value": {"min": 14, "max": 14}, "disabled": false}]});
});

test("combines special source values into normal stat without affix count pseudos", async () => {
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
  const result = structuredClone(payload.query.stats[0].filters);
  assert.deepStrictEqual(result, [{"id": "explicit.stat_1509134228", "value": {"min": 248, "max": 248}, "disabled": false}, {"id": "explicit.stat_691932474", "value": {"min": 161, "max": 161}, "disabled": false}, {"id": "explicit.stat_1368271171", "value": {"min": 27, "max": 27}, "disabled": false}, {"id": "fractured.stat_1509134228", "value": {"min": 178, "max": 178}, "disabled": false}]);
});

test("combines desecrated value into matching normal stat", async () => {
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
  const result = structuredClone(favorite.stats);
  assert.deepStrictEqual(result, [{"id": "explicit.stat_1509134228", "value": {"min": 74, "max": 74}}, {"id": "desecrated.stat_1509134228", "value": {"min": 4, "max": 4}}]);
});

test("migrates flat item favorites into league root order", () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const result = structuredClone(sandbox.Poe2MarketwrightFavorites.createFavoriteTools().normalizeFavoriteFoldersState(
    null,
    [
      { signature: "dawn-old", league: "Dawn", createdAt: 1 },
      { signature: "other", league: "Other League", createdAt: 3 },
      { signature: "dawn-new", league: "Dawn", createdAt: 2 }
    ]
  ));
  assert.deepStrictEqual(result, {
    version: 1,
    leagues: {
      Dawn: {
        folders: [],
        folderOrder: [],
        rootFavoriteSignatures: ["dawn-new", "dawn-old"],
        folderFavoriteSignatures: {}
      },
      "Other League": {
        folders: [],
        folderOrder: [],
        rootFavoriteSignatures: ["other"],
        folderFavoriteSignatures: {}
      }
    }
  });
});

test("normalizes item favorite folder assignments without losing saved items", () => {
  const sandbox = { console };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const result = structuredClone(sandbox.Poe2MarketwrightFavorites.createFavoriteTools().normalizeFavoriteFoldersState(
    {
      version: 1,
      leagues: {
        Dawn: {
          folders: [
            { id: "weapons", name: " Weapons ", createdAt: 5, collapsed: true },
            { id: "weapons", name: "Duplicate" }
          ],
          folderOrder: ["missing", "weapons", "weapons"],
          rootFavoriteSignatures: ["ring", "missing", "ring"],
          folderFavoriteSignatures: { weapons: ["bow", "ring", "bow"] }
        }
      }
    },
    [
      { signature: "ring", league: "Dawn", createdAt: 1 },
      { signature: "bow", league: "Dawn", createdAt: 2 },
      { signature: "axe", league: "Dawn", createdAt: 3 }
    ]
  ));
  assert.deepStrictEqual(result, {
    version: 1,
    leagues: {
      Dawn: {
        folders: [{ id: "weapons", name: "Weapons", createdAt: 5, collapsed: true }],
        folderOrder: ["weapons"],
        rootFavoriteSignatures: ["ring", "axe"],
        folderFavoriteSignatures: { weapons: ["bow"] }
      }
    }
  });
});

test("page bridge forwards trade fetch when favorites are enabled", async () => {
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
  const result = structuredClone(messages.filter((message) => message.source === "poe2-marketwright-favorites"));
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright-favorites", "url": "/api/trade2/fetch/item-1?query=query-1", "body": "{\"result\":[{\"id\":\"item-1\",\"item\":{}}]}"}]);
});

test("link favorite tools validate and create current trade search records", async () => {
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
  const realmless = tools.validateTradeSearchUrl(
    "https://www.pathofexile.com/trade2/search/Runes%20of%20Aldur/X39m5o8WTP"
  );

  const result = structuredClone({ record, invalidCode, realmless });
  assert.deepStrictEqual(result, {"record": {"id": "link-1", "league": "Dawn of the Hunt", "queryId": "query-7", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-7", "displayName": "Warmonger Bow", "folderId": "folder-1", "createdAt": 123, "lastUsedAt": null, "filterGroups": [{"label": "Type Filters", "values": ["Bow", "Rare"]}, {"label": "Stat Filters", "values": ["+# to maximum Life"]}]}, "invalidCode": "invalid_trade_search_url", "realmless": {"url": "https://www.pathofexile.com/trade2/search/Runes%20of%20Aldur/X39m5o8WTP", "league": "Runes of Aldur", "queryId": "X39m5o8WTP"}});
});

test("link favorite rejects legacy flat display snapshots", async () => {
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
  assert.equal(record.displaySnapshot, undefined);
});

test("link favorite preserves structured stat group relationships in its display snapshot", async () => {
  const sandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });
  const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
  const record = tools.createLinkFavoriteRecord({
    url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-7",
    displayName: "Grouped search",
    displaySnapshot: {
      statGroupsVersion: 3,
      statGroups: [
        {
          type: "or",
          filters: [{ id: "explicit.stat_life", value: { min: 50 }, disabled: true }]
        },
        {
          type: "count",
          value: { min: 2 },
          filters: [
            { id: "explicit.stat_fire_resistance", value: { min: 30 } },
            { id: "explicit.stat_cold_resistance", value: { min: 30 } }
          ]
        },
        {
          type: "weighted",
          value: { min: 120, max: 200 },
          filters: [{ id: "explicit.stat_movement_speed", value: { min: 20 }, weight: 2 }]
        },
        {
          type: "and",
          value: { min: null, max: "" },
          filters: [{ id: "explicit.stat_energy_shield", value: { min: 50 } }]
        }
      ]
    }
  });
  const result = structuredClone(record.displaySnapshot);
  assert.deepStrictEqual(result, {"statGroups": [{"type": "or", "filters": [{"id": "explicit.stat_life", "value": {"min": 50}, "disabled": true}]}, {"type": "count", "value": {"min": 2}, "filters": [{"id": "explicit.stat_fire_resistance", "value": {"min": 30}}, {"id": "explicit.stat_cold_resistance", "value": {"min": 30}}]}, {"type": "weighted", "value": {"min": 120, "max": 200}, "filters": [{"id": "explicit.stat_movement_speed", "value": {"min": 20}, "weight": 2}]}, {"type": "and", "filters": [{"id": "explicit.stat_energy_shield", "value": {"min": 50}}]}], "statGroupsVersion": 3});
});

test("page bridge forwards trade search request and query id for link snapshots", async () => {
  const listeners = [];
  const messages = [];
  const stored = new Map();
  const window = {
    app: { $data: { static_: { knownStats: [] } } },
    addEventListener(type, listener) { if (type === "message") listeners.push(listener); },
    postMessage(message) { messages.push(message); },
    sessionStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); }
    },
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
  const result = structuredClone(messages.filter((message) => message.type === "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT"));
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright", "type": "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT", "payload": {"league": "Dawn", "queryId": "query-7", "query": {"query": {"type": "Rider Bow", "stats": [{"filters": [{"id": "explicit.stat_3299347043", "value": {"min": 50}}]}]}}}}]);
  assert.deepStrictEqual(structuredClone(JSON.parse(stored.get("poe2-marketwright:search-snapshot"))), {"league": "Dawn", "queryId": "query-7", "query": {"query": {"type": "Rider Bow", "stats": [{"filters": [{"id": "explicit.stat_3299347043", "value": {"min": 50}}]}]}}});
});

test("page bridge restores the current search snapshot after navigation", () => {
  const listeners = [];
  const messages = [];
  const query = {
    query: {
      type: "Rider Bow",
      stats: [{ filters: [{ id: "explicit.stat_3299347043", value: { min: 50 } }] }]
    }
  };
  const stored = new Map([
    ["poe2-marketwright:search-snapshot", JSON.stringify({ league: "Dawn", queryId: "query-7", query })]
  ]);
  const window = {
    app: { $data: { static_: { knownStats: [] } } },
    location: { pathname: "/trade2/search/poe2/Dawn/query-7" },
    addEventListener(type, listener) { if (type === "message") listeners.push(listener); },
    postMessage(message) { messages.push(message); },
    sessionStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); }
    }
  };
  vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), { window, console }, {
    filename: "page-bridge.js"
  });
  listeners[0]({
    source: window,
    data: { source: "poe2-marketwright", type: "POE2_MARKETWRIGHT_UPDATE", payload: { favoritesEnabled: true } }
  });
  const result = structuredClone(messages.filter((message) => message.type === "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT"));
  assert.deepStrictEqual(result, [{"source": "poe2-marketwright", "type": "POE2_MARKETWRIGHT_SEARCH_SNAPSHOT", "payload": {"league": "Dawn", "queryId": "query-7", "query": {"query": {"type": "Rider Bow", "stats": [{"filters": [{"id": "explicit.stat_3299347043", "value": {"min": 50}}]}]}}}}]);
});

test("link favorite stat summary removes random prefixes and formats special sources", async () => {
  const sandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
  const result = structuredClone({
    regular: tools.formatLinkFavoriteStatFilter(
      "隨機屬性 攻擊附加#至#冰冷傷害[Adds # to # Cold damage to Attacks]:最小40.5/最大40.5"
    ),
    special: tools.formatLinkFavoriteStatFilter(
      "FRACTURED +#% to Item Rarity: Min 18 / Max 18"
    )
  });
  assert.deepStrictEqual(result, {"regular": {"text": "攻擊附加40.5至40.5冰冷傷害", "source": null}, "special": {"text": "+18% to Item Rarity", "source": {"key": "fractured", "label": "FRACTURED"}}});
});

test("link favorite filter ranges use a compact lower-upper format", async () => {
  const sandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
  const result = structuredClone({
    lowerOnly: tools.formatLinkFavoriteFilterRange("Item Level: Min 11"),
    upperOnly: tools.formatLinkFavoriteFilterRange("裝備等級：最大 22"),
    range: tools.formatLinkFavoriteFilterRange("Evasion: Minimum: 700 / Maximum: 900"),
    unchanged: tools.formatLinkFavoriteFilterRange("Corrupted: Yes")
  });
  assert.deepStrictEqual(result, {"lowerOnly": "Item Level: 11 -", "upperOnly": "裝備等級： - 22", "range": "Evasion: 700 - 900", "unchanged": "Corrupted: Yes"});
});

test("link favorite state ignores pre-current versions", async () => {
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

  const result = structuredClone(state);
  assert.deepStrictEqual(result, {"version": 2, "leagues": {}});
});

test("link history normalizes, deduplicates, and keeps its newest entries", async () => {
  const sandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
  const state = tools.normalizeLinkFavoritesState({
    version: 2,
    leagues: {
      Dawn: {
        folders: [],
        folderOrder: [],
        links: [],
        rootLinkIds: [],
        folderLinkIds: {},
        historyCollapsed: true,
        history: [
          {
            id: "old",
            url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
            displayName: "Old name",
            createdAt: 10,
            lastUsedAt: 20
          },
          {
            id: "new",
            url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1?ignored=value",
            displayName: "New name",
            createdAt: 10,
            lastUsedAt: 30
          },
          {
            id: "invalid",
            url: "https://example.test/not-a-trade-search",
            displayName: "Ignored"
          }
        ]
      }
    }
  });
  const updated = tools.upsertLinkFavoriteHistory(
    state.leagues.Dawn.history,
    {
      url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-2",
      displayName: "Second search",
      filterGroups: [{ label: "Type Filters", values: ["Bow"] }]
    },
    2,
    40
  );

  const result = structuredClone({ state, updated });
  const generatedId = result.updated[0].id;
  delete result.updated[0].id;
  assert.deepStrictEqual(result, {
    state: {
      version: 2,
      leagues: {
        Dawn: {
          folders: [],
          folderOrder: [],
          links: [],
          rootLinkIds: [],
          folderLinkIds: {},
          historyCollapsed: true,
          history: [{
            id: "new",
            league: "Dawn",
            queryId: "query-1",
            url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
            displayName: "New name",
            folderId: null,
            createdAt: 10,
            lastUsedAt: 30
          }]
        }
      }
    },
    updated: [
      {
        league: "Dawn",
        queryId: "query-2",
        url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-2",
        displayName: "Second search",
        folderId: null,
        createdAt: 40,
        lastUsedAt: 40,
        filterGroups: [{ label: "Type Filters", values: ["Bow"] }]
      },
      {
        id: "new",
        league: "Dawn",
        queryId: "query-1",
        url: "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-1",
        displayName: "New name",
        folderId: null,
        createdAt: 10,
        lastUsedAt: 30
      }
    ]
  });
  assert.match(generatedId, /^history-/);
});

test("imports external link bookmarks into the selected league idempotently", async () => {
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
  const result = structuredClone({
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
  });
  assert.deepStrictEqual(result, {"first": {"importedFolders": 2, "importedLinks": 3, "skippedLinks": 1, "folderOrder": ["import-folder-first-folder", "import-folder-later-folder"], "folders": [{"id": "import-folder-first-folder", "name": "Helmets", "createdAt": 123, "collapsed": false}, {"id": "import-folder-later-folder", "name": "Bows", "createdAt": 123, "collapsed": true}], "links": [{"id": "import-link-helm", "league": "Dawn of the Hunt", "queryId": "query-helm", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-helm", "displayName": "Helm", "folderId": "import-folder-first-folder", "createdAt": 123, "lastUsedAt": null}, {"id": "import-link-bow-first", "league": "Dawn of the Hunt", "queryId": "query-first", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-first", "displayName": "First bow", "folderId": "import-folder-later-folder", "createdAt": 123, "lastUsedAt": null}, {"id": "import-link-bow-later", "league": "Dawn of the Hunt", "queryId": "query-later", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn%20of%20the%20Hunt/query-later", "displayName": "Late bow", "folderId": "import-folder-later-folder", "createdAt": 123, "lastUsedAt": null}], "folderLinkIds": {"import-folder-first-folder": ["import-link-helm"], "import-folder-later-folder": ["import-link-bow-first", "import-link-bow-later"]}}, "second": {"importedFolders": 0, "importedLinks": 0, "skippedLinks": 4}});
});

test("exports compatible bookmark json and round trips root bookmarks", async () => {
  const sandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });

  const tools = sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
  const state = tools.normalizeLinkFavoritesState({
    version: 2,
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
  const result = structuredClone({ exported, restored });
  assert.deepStrictEqual(result, {"exported": {"folders": [{"id": "folder-helms", "childIds": [], "parentId": null, "depth": 0, "index": 0, "name": "Helmets", "bookmarks": [{"id": "link-helm", "name": "Helm", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-helm", "type": "search", "idx": 0, "isDone": true}], "isOpen": true}, {"id": "folder-bows", "childIds": [], "parentId": null, "depth": 0, "index": 1, "name": "Bows", "bookmarks": [{"id": "link-bow", "name": "Bow", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-bow", "type": "search", "idx": 0, "isDone": true}], "isOpen": false}], "rootBookmarks": [{"id": "link-root", "name": "Root search", "league": "Auto", "poeVersion": "Poe2", "endpoint": "query-root", "type": "search", "idx": 0, "isDone": true}]}, "restored": {"folders": [{"id": "import-folder-folder-helms", "name": "Helmets", "createdAt": 30, "collapsed": false}, {"id": "import-folder-folder-bows", "name": "Bows", "createdAt": 30, "collapsed": true}], "folderOrder": ["import-folder-folder-helms", "import-folder-folder-bows"], "links": [{"id": "import-link-link-helm", "league": "Dawn", "queryId": "query-helm", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-helm", "displayName": "Helm", "folderId": "import-folder-folder-helms", "createdAt": 30, "lastUsedAt": null}, {"id": "import-link-link-bow", "league": "Dawn", "queryId": "query-bow", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-bow", "displayName": "Bow", "folderId": "import-folder-folder-bows", "createdAt": 30, "lastUsedAt": null}, {"id": "import-link-link-root", "league": "Dawn", "queryId": "query-root", "url": "https://www.pathofexile.com/trade2/search/poe2/Dawn/query-root", "displayName": "Root search", "folderId": null, "createdAt": 30, "lastUsedAt": null}], "rootLinkIds": ["import-link-link-root"], "folderLinkIds": {"import-folder-folder-helms": ["import-link-link-helm"], "import-folder-folder-bows": ["import-link-link-bow"]}}});
});
