"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const { parsePobCode, loadExtensionData } = require("../pob-parse");

const CATEGORY_BY_PAGE = {
  Gloves_str: "armour.gloves",
  Boots_str_dex: "armour.boots",
  Rings: "accessory.ring",
  Sceptres: "weapon.sceptre",
  Spears: "weapon.spear",
  Belts: "accessory.belt",
  Life_Flasks: "flask.life",
  Mana_Flasks: "flask.mana",
  Charms: "flask.charm",
  Diamond: "jewel",
  Emerald: "jewel",
  Ruby: "jewel",
  "Time-Lost_Ruby": "jewel",
  Amulets: "accessory.amulet",
  Helmets_str: "armour.helmet",
  Body_Armours_str: "armour.chest",
  One_Hand_Maces: "weapon.onemace"
};

function loadLinkTools() {
  const sandbox = { console, URL };
  vm.runInNewContext(fs.readFileSync("favorites.js", "utf8"), sandbox, {
    filename: "favorites.js"
  });
  return sandbox.Poe2MarketwrightFavorites.createLinkFavoriteTools();
}

test("pending link favorites survive normalize without a trade url", () => {
  const tools = loadLinkTools();
  const record = tools.createLinkFavoriteRecord({
    league: "Dawn",
    displayName: "Gloves: Rift Fingers",
    pendingSearch: {
      query: { status: { option: "available" }, type: "Massive Mitts", stats: [{ type: "and", filters: [] }] },
      sort: { price: "asc" }
    },
    displaySnapshot: { type: "Massive Mitts", rarity: "rare", category: "armour.gloves", statGroupsVersion: 3 }
  });
  assert.equal(record.url, null);
  assert.equal(record.queryId, null);
  assert.ok(record.pendingSearch.query);

  const normalized = tools.normalizeLinkFavoritesState({
    version: 2,
    leagues: { Dawn: { folders: [], folderOrder: [], links: [record], rootLinkIds: [record.id], folderLinkIds: {} } }
  });
  const stored = normalized.leagues.Dawn.links[0];
  assert.equal(stored.displayName, "Gloves: Rift Fingers");
  assert.ok(stored.pendingSearch);
  assert.equal(stored.url, null);

  const materialized = tools.materializePendingLinkFavorite(stored, "abc123", "Dawn");
  assert.match(materialized.url, /\/trade2\/search\/poe2\/Dawn\/abc123$/);
  assert.equal(materialized.queryId, "abc123");
  assert.equal(materialized.pendingSearch, undefined);
});

test("PoB import builds pending searches with slot names, unique name, and -10% rolls", () => {
  const tools = loadLinkTools();
  const parsed = parsePobCode(fs.readFileSync("pob.b64", "utf8"), loadExtensionData());
  const result = tools.importPobLinkFavorites({}, {
    parsed,
    league: "Dawn of the Hunt",
    tolerancePercent: 10,
    categoryByPage: CATEGORY_BY_PAGE
  });

  assert.equal(result.importedFolders, 1);
  assert.ok(result.importedLinks >= 15);
  assert.equal(result.folderName, "PoB · Gemling Legionnaire 98");

  const league = result.state.leagues["Dawn of the Hunt"];
  const names = league.links.map((link) => link.displayName);
  assert.ok(names.includes("Gloves: Rift Fingers"));
  assert.ok(names.includes("Off-hand (swap): Sacred Flame"));
  assert.ok(names.some((name) => name.startsWith("Jewel 1:")));

  const gloveIndex = names.indexOf("Gloves: Rift Fingers");
  const weaponIndex = names.findIndex((name) => name.startsWith("Weapon:"));
  const swapIndex = names.findIndex((name) => name.startsWith("Weapon (swap):"));
  const jewelIndex = names.findIndex((name) => name.startsWith("Jewel 1:"));
  assert.ok(weaponIndex < swapIndex);
  assert.ok(swapIndex < gloveIndex || weaponIndex < gloveIndex);
  assert.ok(jewelIndex > gloveIndex);

  const gloves = league.links.find((link) => link.displayName === "Gloves: Rift Fingers");
  const life = gloves.pendingSearch.query.stats[0].filters.find((filter) => filter.id === "explicit.stat_3299347043");
  assert.equal(life.value.min, 127.8);
  assert.equal(life.value.max, undefined);
  assert.ok(!gloves.pendingSearch.query.stats[0].filters.some((filter) => /^(?:rune\.|bonded)/i.test(filter.id)));
  assert.equal(gloves.url, null);
  assert.equal(gloves.pendingSearch.query.filters.equipment_filters.filters.rune_sockets.min, 1);
  assert.equal(gloves.pendingSearch.query.filters.equipment_filters.filters.ar.min, 827.1);
  assert.equal(gloves.pendingSearch.query.filters.misc_filters, undefined);
  assert.equal(gloves.pendingSearch.query.filters.equipment_filters.filters.dps, undefined);
  assert.equal(gloves.pendingSearch.query.filters.equipment_filters.filters.aps, undefined);

  const boots = league.links.find((link) => link.displayName.startsWith("Boots:"));
  assert.equal(boots.pendingSearch.query.filters.equipment_filters.filters.ar.min, 253.8);
  assert.equal(boots.pendingSearch.query.filters.equipment_filters.filters.ev.min, 230.4);
  assert.equal(boots.pendingSearch.query.filters.equipment_filters.filters.ward.min, 69.3);

  const spear = league.links.find((link) => link.displayName.startsWith("Weapon:"));
  const spearIds = spear.pendingSearch.query.stats[0].filters.map((filter) => filter.id);
  assert.ok(spearIds.includes("explicit.stat_210067635"));
  assert.ok(spearIds.includes("crafted.stat_691932474"));
  assert.ok(!spearIds.includes("explicit.stat_681332047"));

  const sceptre = league.links.find((link) => link.displayName.includes("Sacred Flame"));
  assert.equal(sceptre.pendingSearch.query.name, "Sacred Flame");
  assert.equal(sceptre.pendingSearch.query.type, "Shrine Sceptre");

  const flask = league.links.find((link) => link.displayName.includes("Distiller"));
  const charges = flask.pendingSearch.query.stats[0].filters.find((filter) => filter.id === "explicit.stat_388617051");
  assert.equal(charges.value.max, -22.5);
  assert.equal(charges.value.min, undefined);
  assert.ok(names.every((name) => !name.startsWith("Unequipped:")));
});

test("PoB import localizes display names from the provided item translator", () => {
  const tools = loadLinkTools();
  const parsed = parsePobCode(fs.readFileSync("pob.b64", "utf8"), loadExtensionData());
  const result = tools.importPobLinkFavorites({}, {
    parsed,
    league: "Dawn",
    categoryByPage: CATEGORY_BY_PAGE,
    localizeItem(item) {
      if (item.baseName === "Massive Mitts") {
        return "巨型护手";
      }
      if (item.title === "Mageblood") {
        return "法师之血";
      }
      return "";
    }
  });
  const names = result.state.leagues.Dawn.links.map((link) => link.displayName);
  assert.ok(names.includes("Gloves: 巨型护手"));
  assert.ok(names.includes("Belt: 法师之血"));
  const mageblood = result.state.leagues.Dawn.links.find((link) => link.displayName === "Belt: 法师之血");
  assert.equal(mageblood.pendingSearch.query.name, "Mageblood");
});

test("PoB import skips unequipped stash items but keeps tree jewels", () => {
  const tools = loadLinkTools();
  const parsed = {
    build: { className: "Witch", ascendClassName: "Blood Mage", level: 90 },
    items: [
      {
        id: 1,
        rarity: "RARE",
        name: "Rift Fingers",
        title: "Rift Fingers",
        baseName: "Massive Mitts",
        selection: { kind: "page", id: "Gloves_str" },
        slots: [{ name: "Gloves" }],
        mods: [{ matched: true, statId: "explicit.stat_3299347043", values: [100], line: "+100 to maximum Life" }]
      },
      {
        id: 2,
        rarity: "RARE",
        name: "Stash Mitts",
        title: "Stash Mitts",
        baseName: "Massive Mitts",
        selection: { kind: "page", id: "Gloves_str" },
        slots: [],
        mods: [{ matched: true, statId: "explicit.stat_3299347043", values: [80], line: "+80 to maximum Life" }]
      },
      {
        id: 3,
        rarity: "UNIQUE",
        name: "From Nothing",
        title: "From Nothing",
        baseName: "Diamond",
        selection: { kind: "page", id: "Diamond" },
        slots: [],
        mods: []
      }
    ]
  };
  const result = tools.importPobLinkFavorites({}, {
    parsed,
    league: "Dawn",
    categoryByPage: CATEGORY_BY_PAGE
  });
  const names = result.state.leagues.Dawn.links.map((link) => link.displayName);
  assert.equal(names.join(" | "), "Gloves: Rift Fingers | Jewel 1: From Nothing");
  assert.equal(result.skippedLinks, 1);
});
