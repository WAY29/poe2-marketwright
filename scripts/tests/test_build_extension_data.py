import unittest
import sys
from tempfile import TemporaryDirectory
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

from build_extension_data import (
    PageArtifacts,
    build_trade_stat_records,
    build_trade_stat_universe,
    build_unique_item_names_by_page,
    build_trade_skill_stat_index,
    build_item_name_map,
    build_item_name_selection_map,
    build_page_categories,
    build_trade_stat_index,
    canonicalize_stat_text,
    load_page_artifacts,
    map_granted_skill_names_to_trade_stats,
    map_affix_text_to_trade_stat_ids,
    map_trade_stat_texts_to_trade_stat_ids,
    parse_page_html_artifacts,
    poe2db_item_slug,
    split_affix_stat_lines,
)


class TradeStatMappingTests(unittest.TestCase):
    def test_builds_trade_stat_universe_from_official_stats(self) -> None:
        patterns, stat_ids = build_trade_stat_universe(
            {
                "result": [
                    {
                        "id": "explicit",
                        "entries": [
                            {"id": "explicit.stat_allowed", "text": "# to Strength"},
                            {"id": "explicit.stat_not_in_category", "text": "# to Dexterity"},
                            {"id": "explicit.stat_timeless|1", "text": "Only affects Passives in Very Small Ring"},
                            {"id": "", "text": "# ignored"},
                            {"id": "explicit.stat_no_text"},
                        ],
                    },
                    {
                        "id": "pseudo",
                        "entries": [
                            {"id": "pseudo.pseudo_total_strength", "text": "+# total to Strength"},
                        ],
                    },
                ]
            }
        )

        self.assertEqual(
            patterns,
            [
                "# to Dexterity",
                "# to Strength",
                "# total to Strength",
                "Only affects Passives in Very Small Ring",
            ],
        )
        self.assertEqual(
            stat_ids,
            [
                "explicit.stat_allowed",
                "explicit.stat_not_in_category",
                "explicit.stat_timeless|1",
                "pseudo.pseudo_total_strength",
            ],
        )

    def test_adds_synthetic_waystone_tier_item_names(self) -> None:
        artifacts = [
            PageArtifacts(
                page_slug="Waystones_low_tier",
                page_group=None,
                page_url="https://poe2db.tw/us/Waystones_low_tier",
                baseitem_name="Waystones low tier",
                allowed_patterns=[],
                allowed_stat_ids=[],
                item_names=[],
            ),
            PageArtifacts(
                page_slug="Waystones_mid_tier",
                page_group=None,
                page_url="https://poe2db.tw/us/Waystones_mid_tier",
                baseitem_name="Waystones mid tier",
                allowed_patterns=[],
                allowed_stat_ids=[],
                item_names=[],
            ),
            PageArtifacts(
                page_slug="Waystones_top_tier",
                page_group=None,
                page_url="https://poe2db.tw/us/Waystones_top_tier",
                baseitem_name="Waystones top tier",
                allowed_patterns=[],
                allowed_stat_ids=[],
                item_names=[],
            ),
        ]

        page_categories = build_page_categories(artifacts, {})
        item_name_to_selection = build_item_name_selection_map(
            {
                "result": [
                    {
                        "id": "map",
                        "entries": [
                            {"type": "Waystone (Tier 1)"},
                            {"type": "Waystone (Tier 5)"},
                            {"type": "Waystone (Tier 6)"},
                            {"type": "Waystone (Tier 10)"},
                            {"type": "Waystone (Tier 11)"},
                            {"type": "Waystone (Tier 16)"},
                        ],
                    },
                ],
            },
            page_categories,
        )

        self.assertIn("Waystone (Tier 1)", page_categories["Waystones_low_tier"]["itemNames"])
        self.assertEqual(item_name_to_selection["waystone (tier 1)"], {"kind": "page", "id": "Waystones_low_tier"})
        self.assertEqual(item_name_to_selection["waystone (tier 5)"], {"kind": "page", "id": "Waystones_low_tier"})
        self.assertEqual(item_name_to_selection["waystone (tier 6)"], {"kind": "page", "id": "Waystones_mid_tier"})
        self.assertEqual(item_name_to_selection["waystone (tier 10)"], {"kind": "page", "id": "Waystones_mid_tier"})
        self.assertEqual(item_name_to_selection["waystone (tier 11)"], {"kind": "page", "id": "Waystones_top_tier"})
        self.assertEqual(item_name_to_selection["waystone (tier 16)"], {"kind": "page", "id": "Waystones_top_tier"})

    def test_official_trade_items_drive_item_name_selections(self) -> None:
        artifacts = [
            PageArtifacts(
                page_slug="Expedition_Tablet",
                page_group=None,
                page_url="https://poe2db.tw/us/Expedition_Tablet#ModifiersCalc",
                baseitem_name="Expedition Tablet",
                allowed_patterns=[],
                allowed_stat_ids=[],
                item_names=[],
            ),
            PageArtifacts(
                page_slug="Delirium_Tablet",
                page_group=None,
                page_url="https://poe2db.tw/us/Delirium_Tablet#ModifiersCalc",
                baseitem_name="Delirium Tablet",
                allowed_patterns=[],
                allowed_stat_ids=[],
                item_names=[],
            ),
            PageArtifacts(
                page_slug="Waystones_low_tier",
                page_group=None,
                page_url="https://poe2db.tw/us/Waystones_low_tier",
                baseitem_name="Waystones low tier",
                allowed_patterns=[],
                allowed_stat_ids=[],
                item_names=[],
            ),
        ]
        page_categories = build_page_categories(
            artifacts,
            {"Expedition_Tablet": ["Serle's Triumph", "Expedition Tablet", "Expedition Logbook"]},
        )
        trade_items_payload = {
            "result": [
                {
                    "id": "map",
                    "entries": [
                        {"type": "Expedition Logbook"},
                        {"type": "Expedition Tablet"},
                        {"type": "Waystone (Tier 1)"},
                        {"type": "Simulacrum"},
                        {
                            "type": "Delirium Tablet",
                            "text": "Clear Skies Delirium Tablet",
                            "name": "Clear Skies",
                        },
                    ],
                },
            ],
        }
        item_name_to_selection = build_item_name_selection_map(trade_items_payload, page_categories)
        item_name_to_page = build_item_name_map(page_categories, item_name_to_selection)

        self.assertNotIn("expedition tablet", item_name_to_page)
        self.assertNotIn("expedition logbook", item_name_to_page)
        self.assertNotIn("serle's triumph", item_name_to_page)
        self.assertEqual(
            item_name_to_selection["expedition tablet"],
            {"kind": "page", "id": "Expedition_Tablet"},
        )
        self.assertEqual(
            item_name_to_selection["expedition logbook"],
            {"kind": "logical", "id": "Maps"},
        )
        self.assertEqual(
            item_name_to_selection["waystone (tier 1)"],
            {"kind": "page", "id": "Waystones_low_tier"},
        )
        self.assertEqual(
            item_name_to_selection["simulacrum"],
            {"kind": "logical", "id": "Maps"},
        )
        self.assertEqual(
            item_name_to_selection["clear skies delirium tablet"],
            {"kind": "page", "id": "Delirium_Tablet"},
        )
        self.assertNotIn("clear skies", item_name_to_selection)
        self.assertEqual(
            item_name_to_selection["探险日志"],
            {"kind": "logical", "id": "Maps"},
        )
        self.assertEqual(
            item_name_to_selection["探險日誌"],
            {"kind": "logical", "id": "Maps"},
        )

    def test_loads_charm_specific_trade_stat_aliases(self) -> None:
        trade_stat_index = build_trade_stat_index(
            {
                "result": [
                    {
                        "id": "explicit",
                        "entries": [
                            {
                                "id": "explicit.stat_charm_duration",
                                "text": "#% increased Duration (Charm)",
                            },
                            {
                                "id": "explicit.stat_reduced_charm_charges_used",
                                "text": "#% reduced Charm Charges used",
                            },
                            {
                                "id": "explicit.stat_charm_charges_gained",
                                "text": "#% increased Charm Charges gained",
                            },
                        ],
                    },
                    {
                        "id": "implicit",
                        "entries": [
                            {
                                "id": "implicit.stat_reduced_charm_charges_used",
                                "text": "#% reduced Charm Charges used",
                            },
                        ],
                    },
                ]
            }
        )

        with TemporaryDirectory() as directory:
            split_dir = Path(directory)
            (split_dir / "index.json").write_text(
                """
                {
                  "pages": [
                    {
                      "page_slug": "Charms",
                      "page_group": null,
                      "page_url": "https://poe2db.tw/us/Charms#ModifiersCalc",
                      "baseitem_name": "Charms",
                      "item_class_code": "UtilityFlask",
                      "file": "Charms.json"
                    }
                  ]
                }
                """,
                encoding="utf-8",
            )
            (split_dir / "Charms.json").write_text(
                """
                {
                  "affixes": [
                    {"text_html": "<span class='mod-value'>(16-20)</span>% increased Duration"},
                    {"text_html": "<span class='mod-value'>(15-17)</span>% reduced Charges per use"},
                    {"text_html": "<span class='mod-value'>(23-30)</span>% increased Charges gained"}
                  ]
                }
                """,
                encoding="utf-8",
            )

            [charms] = load_page_artifacts(split_dir, trade_stat_index)

        self.assertIn("#% increased Duration (Charm)", charms.allowed_patterns)
        self.assertIn("#% reduced Charm Charges used", charms.allowed_patterns)
        self.assertIn("#% increased Charm Charges gained", charms.allowed_patterns)
        self.assertIn("explicit.stat_charm_duration", charms.allowed_stat_ids)
        self.assertIn("explicit.stat_reduced_charm_charges_used", charms.allowed_stat_ids)
        self.assertIn("implicit.stat_reduced_charm_charges_used", charms.allowed_stat_ids)
        self.assertIn("explicit.stat_charm_charges_gained", charms.allowed_stat_ids)

    def test_discovers_unique_item_names_by_page_from_trade_items(self) -> None:
        self.assertEqual(poe2db_item_slug("Ngamahu's Chosen"), "Ngamahus_Chosen")
        self.assertEqual(poe2db_item_slug("The Knight-errant"), "The_Knight-errant")
        self.assertEqual(poe2db_item_slug("Mjölner"), "Mjölner")
        self.assertEqual(poe2db_item_slug("The Fall of the Axe"), "The_Fall_of_the_Axe")

        page_categories = build_page_categories(
            [
                PageArtifacts(
                    page_slug="Charms",
                    page_group=None,
                    page_url="https://poe2db.tw/us/Charms#ModifiersCalc",
                    baseitem_name="Charms",
                    allowed_patterns=[],
                    allowed_stat_ids=[],
                    item_names=[],
                ),
                PageArtifacts(
                    page_slug="Belts",
                    page_group="Belts",
                    page_url="https://poe2db.tw/us/Belts#ModifiersCalc",
                    baseitem_name="Belts",
                    allowed_patterns=[],
                    allowed_stat_ids=[],
                    item_names=[],
                ),
            ],
            {
                "Charms": ["Ruby Charm"],
                "Belts": ["Rawhide Belt"],
            },
        )
        unique_names_by_page = build_unique_item_names_by_page(
            {
                "result": [
                    {
                        "id": "flask",
                        "entries": [
                            {
                                "type": "Ruby Charm",
                                "text": "Ngamahu's Chosen Ruby Charm",
                                "name": "Ngamahu's Chosen",
                                "flags": {"unique": True},
                            },
                            {
                                "type": "Ruby Charm",
                                "name": "Plain Ruby Charm",
                                "flags": {},
                            },
                            {
                                "type": "Life Flask",
                                "name": "Unique Flask",
                                "flags": {"unique": True},
                            },
                            {
                                "type": "Ruby Charm",
                                "name": "Legacy Charm",
                                "disc": "legacy",
                                "flags": {"unique": True},
                            },
                        ],
                    },
                    {
                        "id": "accessory",
                        "entries": [
                            {
                                "type": "Rawhide Belt",
                                "text": "Meginord's Girdle Rawhide Belt",
                                "name": "Meginord's Girdle",
                                "flags": {"unique": True},
                            }
                        ],
                    },
                ]
            },
            page_categories,
        )

        self.assertEqual(
            unique_names_by_page,
            {
                "Belts": ["Meginord's Girdle"],
                "Charms": ["Ngamahu's Chosen"],
            },
        )

    def test_maps_unique_item_placeholder_trade_stat_text(self) -> None:
        trade_stats_payload = {
            "result": [
                {
                    "id": "explicit",
                    "entries": [
                        {
                            "id": "explicit.stat_spirit_serpent",
                            "text": "Possessed by Spirit Of The Serpent for # seconds on use",
                        },
                        {
                            "id": "explicit.stat_spirit_boar",
                            "text": "Possessed by Spirit Of The Boar for # seconds on use",
                        },
                    ],
                }
            ]
        }
        trade_stat_index = build_trade_stat_index(trade_stats_payload)
        trade_stat_records = build_trade_stat_records(trade_stats_payload)

        patterns, stat_ids = map_trade_stat_texts_to_trade_stat_ids(
            ["Possessed by Spirit Of The [Azmeri Spirit] for (10-20) seconds on use"],
            trade_stat_index,
            trade_stat_records,
        )

        self.assertIn("Possessed by Spirit Of The Serpent for # seconds on use", patterns)
        self.assertEqual(
            stat_ids,
            ["explicit.stat_spirit_boar", "explicit.stat_spirit_serpent"],
        )

    def test_does_not_wildcard_untrusted_bracket_text(self) -> None:
        trade_stats_payload = {
            "result": [
                {
                    "id": "explicit",
                    "entries": [
                        {
                            "id": "explicit.stat_life",
                            "text": "+# to maximum Life",
                        },
                        {
                            "id": "explicit.stat_mana",
                            "text": "+# to maximum Mana",
                        },
                    ],
                }
            ]
        }
        trade_stat_index = build_trade_stat_index(trade_stats_payload)
        trade_stat_records = build_trade_stat_records(trade_stats_payload)

        patterns, stat_ids = map_trade_stat_texts_to_trade_stat_ids(
            ["[Custom Desecrated prefix]"],
            trade_stat_index,
            trade_stat_records,
            include_unmatched_patterns=False,
        )

        self.assertEqual(patterns, [])
        self.assertEqual(stat_ids, [])

    def test_splits_poe2db_combined_mods_and_maps_each_trade_stat(self) -> None:
        trade_stat_index = build_trade_stat_index(
            {
                "result": [
                    {
                        "id": "explicit",
                        "entries": [
                            {
                                "id": "explicit.stat_pack_size",
                                "text": "#% reduced Pack Size in Map",
                            },
                            {
                                "id": "explicit.stat_waystones",
                                "text": "#% increased Quantity of Waystones found in Map",
                            },
                            {
                                "id": "explicit.stat_shrine",
                                "text": "Map contains # additional Shrine",
                            },
                        ],
                    }
                ]
            }
        )

        patterns, stat_ids = map_affix_text_to_trade_stat_ids(
            "% reduced Pack Size in Map<br>"
            "% increased Quantity of <a href='Waystones'>Waystones</a> found in Map<br>"
            "Map contains <span class='mod-value'>1</span> additional Shrines",
            trade_stat_index,
        )

        self.assertEqual(
            patterns,
            [
                "#% reduced Pack Size in Map",
                "#% increased Quantity of Waystones found in Map",
                "Map contains # additional Shrines",
            ],
        )
        self.assertEqual(
            stat_ids,
            [
                "explicit.stat_pack_size",
                "explicit.stat_shrine",
                "explicit.stat_waystones",
            ],
        )

    def test_keeps_duplicate_official_groups_for_same_text(self) -> None:
        trade_stat_index = build_trade_stat_index(
            {
                "result": [
                    {
                        "id": "explicit",
                        "entries": [
                            {
                                "id": "explicit.stat_pack_size",
                                "text": "#% increased Pack Size in Map",
                            }
                        ],
                    },
                    {
                        "id": "enchant",
                        "entries": [
                            {
                                "id": "enchant.stat_pack_size",
                                "text": "#% increased Pack Size in Map",
                            }
                        ],
                    },
                ]
            }
        )

        _, stat_ids = map_affix_text_to_trade_stat_ids(
            "<span class='mod-value'>(5-7)</span>% increased Pack Size in Map",
            trade_stat_index,
        )

        self.assertEqual(
            stat_ids,
            [
                "enchant.stat_pack_size",
                "explicit.stat_pack_size",
            ],
        )

    def test_canonicalizes_missing_numeric_percent_placeholders(self) -> None:
        self.assertEqual(
            canonicalize_stat_text("% reduced Pack Size in Map"),
            "#% reduced Pack Size in Map",
        )

    def test_split_affix_stat_lines_preserves_br_boundaries(self) -> None:
        self.assertEqual(
            split_affix_stat_lines("First<br/>Second<br />Third"),
            ["First", "Second", "Third"],
        )

    def test_extracts_granted_skill_names_from_poe2db_item_page(self) -> None:
        artifacts = parse_page_html_artifacts(
            """
            <a class="whiteitem Sceptre" href="Rattling_Sceptre">Rattling Sceptre</a>
            <div class="implicitMod">
              <img class="grantsSkill"/>
              Grants Skill: <a class="gem_blue" href="/us/Skeletal_Warrior">Skeletal Warrior</a>
            </div>
            <div class="implicitMod">
              <img class="grantsSkill">
              Grants Skill: Level 13 <a class="gem_blue" href="/us/Lightning_Bolt">Lightning Bolt</a>
            </div>
            """
        )

        self.assertEqual(artifacts.item_names, ["Rattling Sceptre"])
        self.assertEqual(artifacts.granted_skill_names, ["Skeletal Warrior", "Lightning Bolt"])

    def test_filters_page_item_names_by_item_class_code(self) -> None:
        artifacts = parse_page_html_artifacts(
            """
            <a class="whiteitem UtilityFlask" href="Thawing_Charm">Thawing Charm</a>
            <a class="whiteitem Belt" href="Rawhide_Belt">Rawhide Belt</a>
            <a class="whiteitem SoulCore" href="Rune_of_Acrobatics">Rune of Acrobatics</a>
            """,
            item_class_code="UtilityFlask",
        )

        self.assertEqual(artifacts.item_names, ["Thawing Charm"])

    def test_extracts_unique_item_mod_texts_from_poe2db_item_page(self) -> None:
        artifacts = parse_page_html_artifacts(
            """
            <div class="implicitMod">Used when you become Frozen</div>
            <div class="explicitMod">
              Energy Shield Recharge starts on use
            </div>
            """
        )

        self.assertEqual(
            artifacts.item_mod_texts,
            [
                "Used when you become Frozen",
                "Energy Shield Recharge starts on use",
            ],
        )

    def test_adds_poe2db_granted_skills_to_page_categories(self) -> None:
        trade_skill_stat_index = build_trade_skill_stat_index(
            {
                "result": [
                    {
                        "id": "skill",
                        "entries": [
                            {
                                "id": "skill.summon_skeleton_warrior",
                                "text": "Grants Skill: Level # Skeletal Warrior Minion",
                            },
                            {
                                "id": "skill.discipline",
                                "text": "Grants Skill: Level # Discipline",
                            },
                        ],
                    }
                ]
            }
        )
        granted_patterns, granted_stat_ids = map_granted_skill_names_to_trade_stats(
            ["Skeletal Warrior", "Discipline"],
            trade_skill_stat_index,
        )
        page_categories = build_page_categories(
            [
                PageArtifacts(
                    page_slug="Sceptres",
                    page_group="Sceptres",
                    page_url="https://poe2db.tw/us/Sceptres#ModifiersCalc",
                    baseitem_name="Sceptres",
                    allowed_patterns=[],
                    allowed_stat_ids=[],
                    item_names=[],
                )
            ],
            {},
            {"Sceptres": granted_patterns},
            {"Sceptres": granted_stat_ids},
        )

        self.assertEqual(
            page_categories["Sceptres"]["allowedPatterns"],
            [
                "Grants Skill: Level # Discipline",
                "Grants Skill: Level # Skeletal Warrior Minion",
            ],
        )
        self.assertEqual(
            page_categories["Sceptres"]["allowedStatIds"],
            [
                "skill.discipline",
                "skill.summon_skeleton_warrior",
            ],
        )


if __name__ == "__main__":
    unittest.main()
