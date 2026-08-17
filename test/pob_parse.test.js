"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const {
  decodePobCode,
  normalizeAffixKey,
  parseItemText,
  parsePobCode,
  loadExtensionData
} = require("../pob-parse");

test("decodePobCode inflates the sample share code", () => {
  const xml = decodePobCode(fs.readFileSync("pob.b64", "utf8"));
  assert.match(xml, /<PathOfBuilding2>/);
  assert.match(xml, /<Item id="1">/);
  assert.match(xml, /Rift Fingers/);
});

test("previewPobBuild reads class and level from the share code", async () => {
  const { previewPobBuild } = require("../pob-parse");
  const build = await previewPobBuild(fs.readFileSync("pob.b64", "utf8"));
  assert.equal(build.className, "Mercenary");
  assert.equal(build.ascendClassName, "Gemling Legionnaire");
  assert.equal(build.level, 98);
});

test("parseItemText maps tagged lines onto extension stat ids", () => {
  const data = loadExtensionData();
  const item = parseItemText(
    [
      "Rarity: RARE",
      "Rift Fingers",
      "Massive Mitts",
      "Quality: 25",
      "Sockets: S",
      "Rune: Idol of Sirrius",
      "Implicits: 2",
      "{enchant}{rune}8% increased Attack Speed",
      "{enchant}{rune}Bonded: 20% reduced Slowing Potency of Debuffs on You",
      "{desecrated}+34% of Armour also applies to Elemental Damage",
      "+142 to maximum Life",
      "+2 to Level of all Melee Skills",
      "{crafted}+25 to Dexterity",
      "Corrupted"
    ].join("\n"),
    require("../pob-parse").createLookup(data)
  );

  assert.equal(item.rarity, "RARE");
  assert.equal(item.baseName, "Massive Mitts");
  assert.deepEqual(item.selection, { kind: "page", id: "Gloves_str" });
  assert.equal(item.corrupted, true);
  assert.deepEqual(item.runes, ["Idol of Sirrius"]);

  const byLine = Object.fromEntries(item.mods.map((mod) => [mod.line, mod]));
  assert.equal(byLine["8% increased Attack Speed"].statId, "rune.stat_681332047");
  assert.equal(byLine["+142 to maximum Life"].statId, "explicit.stat_3299347043");
  assert.equal(byLine["+34% of Armour also applies to Elemental Damage"].statId, "desecrated.stat_3362812763");
  assert.equal(byLine["+25 to Dexterity"].statId, "crafted.stat_3261801346");
  assert.equal(byLine["+2 to Level of all Melee Skills"].matched, true);
  assert.equal(
    byLine["Bonded: 20% reduced Slowing Potency of Debuffs on You"].statId,
    "rune.stat_165746512"
  );
  assert.deepEqual(byLine["Bonded: 20% reduced Slowing Potency of Debuffs on You"].values, [-20]);
});

test("parseItemText uses the Local affix when that stat exists on the item page", () => {
  const lookup = require("../pob-parse").createLookup(loadExtensionData());
  const weapon = parseItemText(
    [
      "Rarity: RARE",
      "Vengeance Edge",
      "Soaring Spear",
      "Implicits: 0",
      "28% increased Attack Speed",
      "{crafted}+349 to Accuracy Rating"
    ].join("\n"),
    lookup
  );
  const armour = parseItemText(
    [
      "Rarity: RARE",
      "Rift Fingers",
      "Massive Mitts",
      "Implicits: 0",
      "+186 to Armour",
      "97% increased Armour",
      "8% increased Attack Speed"
    ].join("\n"),
    lookup
  );
  const weaponMods = Object.fromEntries(weapon.mods.map((mod) => [mod.line, mod]));
  const armourMods = Object.fromEntries(armour.mods.map((mod) => [mod.line, mod]));
  assert.equal(weaponMods["28% increased Attack Speed"].statId, "explicit.stat_210067635");
  assert.equal(weaponMods["+349 to Accuracy Rating"].statId, "crafted.stat_691932474");
  assert.equal(armourMods["+186 to Armour"].statId, "explicit.stat_3484657501");
  assert.equal(armourMods["97% increased Armour"].statId, "explicit.stat_1062208444");
  assert.equal(armourMods["8% increased Attack Speed"].statId, "explicit.stat_681332047");
});

test("parsePobCode uses Local weapon affixes when the base only has a logical category", () => {
  const parsed = parsePobCode(fs.readFileSync("pob.b64", "utf8"), loadExtensionData());
  const club = parsed.items.find((item) => item.title === "Olrovasara");
  const body = parsed.items.find((item) => item.title === "Loreweave");
  assert.equal(club.selection.id, "Weapons");
  const clubMods = Object.fromEntries(club.mods.map((mod) => [mod.line, mod]));
  assert.equal(clubMods["30% increased Attack Speed"].statId, "explicit.stat_210067635");
  assert.equal(clubMods["+343 to Accuracy Rating"].statId, "explicit.stat_691932474");
  assert.equal(clubMods["10% increased Attack Speed"].statId, "rune.stat_681332047");
  assert.equal(
    body.mods.find((mod) => mod.line === "+282 to Accuracy Rating").statId,
    "explicit.stat_803737631"
  );
});

test("parsePobCode attaches equipped slots and unique bases from the sample", () => {
  const parsed = parsePobCode(fs.readFileSync("pob.b64", "utf8"), loadExtensionData());
  assert.equal(parsed.build.className, "Mercenary");
  assert.equal(parsed.build.ascendClassName, "Gemling Legionnaire");
  assert.ok(parsed.items.length >= 15);

  const gloves = parsed.items.find((item) => item.id === 1);
  assert.equal(gloves.baseName, "Massive Mitts");
  assert.deepEqual(gloves.slots.map((slot) => slot.name), ["Gloves"]);
  assert.ok(gloves.mods.some((mod) => mod.statId === "explicit.stat_3299347043"));

  const unique = parsed.items.find((item) => item.title === "Sacred Flame");
  assert.equal(unique.baseName, "Shrine Sceptre");
  assert.deepEqual(unique.selection, { kind: "page", id: "Sceptres" });
  assert.ok(unique.mods.some((mod) => mod.statId === "skill.purity_of_fire"));
});

test("parseItemText maps flask reduced text onto increased trade stats", () => {
  const item = parseItemText(
    [
      "Rarity: MAGIC",
      "Potent Ultimate Life Flask of the Distiller",
      "Implicits: 0",
      "72% increased Amount Recovered",
      "25% reduced Charges per use"
    ].join("\n"),
    require("../pob-parse").createLookup(loadExtensionData())
  );
  const unique = parseItemText(
    [
      "Rarity: UNIQUE",
      "Uhtred's Chalice",
      "Transcendent Mana Flask",
      "Implicits: 0",
      "298% increased Amount Recovered",
      "70% reduced Recovery rate",
      "57% reduced Charges"
    ].join("\n"),
    require("../pob-parse").createLookup(loadExtensionData())
  );
  const life = Object.fromEntries(item.mods.map((mod) => [mod.line, mod]));
  const mana = Object.fromEntries(unique.mods.map((mod) => [mod.line, mod]));
  assert.equal(life["25% reduced Charges per use"].statId, "explicit.stat_388617051");
  assert.deepEqual(life["25% reduced Charges per use"].values, [-25]);
  assert.equal(mana["70% reduced Recovery rate"].statId, "explicit.stat_173226756");
  assert.deepEqual(mana["70% reduced Recovery rate"].values, [-70]);
  assert.equal(mana["57% reduced Charges"].statId, "explicit.stat_1366840608");
  assert.deepEqual(mana["57% reduced Charges"].values, [-57]);
});

test("normalizeAffixKey collapses rolls the same way as the extension", () => {
  assert.equal(normalizeAffixKey("+142 to maximum Life"), "# to maximum life");
  assert.equal(normalizeAffixKey("Adds 21 to 36 Cold damage to Attacks"), "adds # to # cold damage to attacks");
});

test("parseItemText joins wrapped unique lines and decodes xml entities", () => {
  const item = parseItemText(
    [
      "Rarity: UNIQUE",
      "From Nothing",
      "Diamond",
      "Implicits: 0",
      "Passives in Radius of Blood Magic can be Allocated",
      "without being connected to your tree",
      "All Mage&apos;s Legacies have 49% increased effect per duplicate Mage&apos;s Legacy you have",
      "Has 2 Charm Slots"
    ].join("\n"),
    require("../pob-parse").createLookup(loadExtensionData())
  );
  const byLine = Object.fromEntries(item.mods.map((mod) => [mod.line, mod]));
  assert.equal(
    byLine["Passives in Radius of Blood Magic can be Allocated without being connected to your tree"].statId,
    "explicit.stat_2422708892|51749"
  );
  assert.equal(
    byLine["All Mage's Legacies have 49% increased effect per duplicate Mage's Legacy you have"].statId,
    "explicit.stat_3874491706"
  );
  assert.equal(byLine["Has 2 Charm Slots"].statId, "explicit.stat_1416292992");
});
