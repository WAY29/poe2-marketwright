import unittest
import sys
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

from build_extension_data import (
    PageArtifacts,
    build_item_name_map,
    build_page_categories,
    build_trade_stat_index,
    canonicalize_stat_text,
    map_affix_text_to_trade_stat_ids,
    split_affix_stat_lines,
)


class TradeStatMappingTests(unittest.TestCase):
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

        item_name_to_page = build_item_name_map(build_page_categories(artifacts, {}))

        self.assertEqual(item_name_to_page["waystone (tier 1)"], "Waystones_low_tier")
        self.assertEqual(item_name_to_page["waystone (tier 5)"], "Waystones_low_tier")
        self.assertEqual(item_name_to_page["waystone (tier 6)"], "Waystones_mid_tier")
        self.assertEqual(item_name_to_page["waystone (tier 10)"], "Waystones_mid_tier")
        self.assertEqual(item_name_to_page["waystone (tier 11)"], "Waystones_top_tier")
        self.assertEqual(item_name_to_page["waystone (tier 16)"], "Waystones_top_tier")

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


if __name__ == "__main__":
    unittest.main()
