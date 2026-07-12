import unittest
import sys
from tempfile import TemporaryDirectory
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

from build_extension_data import (
    DisplayMetadataCoverageError,
    PageArtifacts,
    TradeLocalizationCoverageError,
    build_safe_numeric_trade_item_localizations,
    build_trade_filter_page_localizations,
    build_trade_category_page_localizations,
    build_trade_item_localization_bundle,
    build_display_metadata,
    build_client_string_localizations,
    build_trade_stat_group_records,
    build_item_display_metadata,
    build_trade_localization_metadata,
    build_trade_stat_records,
    build_trade_stat_universe,
    collect_base_item_mod_stat_artifacts,
    build_unique_item_names_by_page,
    build_trade_skill_stat_index,
    build_item_name_map,
    build_item_name_selection_map,
    build_page_categories,
    build_trade_stat_index,
    build_tier_mappings,
    canonicalize_stat_text,
    extract_rollable_ranges,
    extract_rollable_minimums,
    normalize_poe2db_localized_stat_template,
    load_page_artifacts,
    map_granted_skill_names_to_trade_stats,
    map_affix_text_to_trade_stat_ids,
    map_trade_stat_texts_to_trade_stat_ids,
    parse_page_html_artifacts,
    parse_poe2db_item_title,
    parse_poe2db_item_name_slugs,
    parse_poe2db_stat_source_records,
    build_verified_poe2db_stat_mod_localizations,
    apply_verified_poe2db_stat_localizations,
    apply_verified_item_prefix_localizations,
    poe2db_item_slug,
    split_affix_stat_lines,
)


class TradeStatMappingTests(unittest.TestCase):
    def test_ignores_fixed_numbers_when_extracting_rollable_minimums(self) -> None:
        self.assertEqual(
            extract_rollable_minimums(
                "Adds <span class='mod-value'>(16-20)</span> to "
                "<span class='mod-value'>(25-31)</span> Cold Damage per 25 Strength"
            ),
            [16.0, 25.0],
        )

    def test_extracts_complete_ranges_when_the_dash_is_in_a_nested_span(self) -> None:
        self.assertEqual(
            extract_rollable_ranges(
                "Adds <span class='mod-value'>(12<span class=\"ndash\">—</span>19)</span> to "
                "<span class='mod-value'>(22<span class=\"ndash\">—</span>32)</span> Physical Damage"
            ),
            [(12.0, 19.0), (22.0, 32.0)],
        )

    def test_skips_ambiguous_tier_sequences_for_one_trade_stat(self) -> None:
        def affix(code: str, value: int) -> dict[str, object]:
            return {
                "affix_group": "normal",
                "code": code,
                "families": ["Strength"],
                "text_html": f"<span class='mod-value'>+({value}-{value + 2})</span> to Strength",
            }

        self.assertEqual(
            build_tier_mappings(
                {"Rings": [affix("Strength1", 5), affix("Strength2", 9), affix("AltStrength1", 12), affix("AltStrength2", 16)]},
                {"# to strength": {"explicit.stat_strength"}},
            ),
            {},
        )

    def test_requires_an_exact_trade_stat_for_semantic_suffixes(self) -> None:
        def affix(code: str, values: tuple[int, int]) -> dict[str, object]:
            return {
                "affix_group": "normal",
                "code": code,
                "families": ["PhysicalDamage"],
                "text_html": (
                    "Adds "
                    f"<span class='mod-value'>({values[0]}-{values[0] + 2})</span> to "
                    f"<span class='mod-value'>({values[1]}-{values[1] + 2})</span> Physical Damage to Attacks"
                ),
            }

        self.assertEqual(
            build_tier_mappings(
                {"Rings": [affix("AddedPhysicalDamage1", (1, 3)), affix("AddedPhysicalDamage2", (4, 8))]},
                {
                    "adds # to # physical damage": {"explicit.stat_generic_damage"},
                },
            ),
            {},
        )

    def test_builds_page_scoped_tier_mappings_from_verified_affix_families(self) -> None:
        trade_stat_index = {
            "# to strength": {
                "crafted.stat_strength",
                "explicit.stat_strength",
            },
            "#% reduced curse effect": {"explicit.stat_curse_effect"},
            "adds # to # cold damage to attacks": {"explicit.stat_cold_damage"},
        }
        affixes = {
            "Rings": [
                {
                    "affix_group": "normal",
                    "code": "Strength1",
                    "hover": "?s=Data%5CMods%2FStrength1",
                    "required_level": 1,
                    "families": ["Strength"],
                    "text_html": "<span class='mod-value'>+(5-8)</span> to Strength",
                },
                {
                    "affix_group": "normal",
                    "code": "Strength2",
                    "hover": "?s=Data%5CMods%2FStrength2",
                    "required_level": 11,
                    "families": ["Strength"],
                    "text_html": "<span class='mod-value'>+(9-12)</span> to Strength",
                },
                {
                    "affix_group": "normal",
                    "code": "Strength3",
                    "hover": "?s=Data%5CMods%2FStrength3",
                    "required_level": 22,
                    "families": ["Strength"],
                    "text_html": "<span class='mod-value'>+(13-16)</span> to Strength",
                },
                {
                    "affix_group": "normal",
                    "code": "CurseEffect1",
                    "hover": "?s=Data%5CMods%2FCurseEffect1",
                    "required_level": 1,
                    "families": ["CurseEffect"],
                    "text_html": "<span class='mod-value'>-(5-8)%</span> reduced Curse Effect",
                },
                {
                    "affix_group": "normal",
                    "code": "CurseEffect2",
                    "hover": "?s=Data%5CMods%2FCurseEffect2",
                    "required_level": 20,
                    "families": ["CurseEffect"],
                    "text_html": "<span class='mod-value'>-(10-12)%</span> reduced Curse Effect",
                },
                {
                    "affix_group": "normal",
                    "code": "ColdDamage1",
                    "hover": "?s=Data%5CMods%2FColdDamage1",
                    "required_level": 1,
                    "families": ["ColdDamage"],
                    "text_html": "Adds <span class='mod-value'>(4-6)</span> to <span class='mod-value'>(8-10)</span> Cold Damage to Attacks",
                },
                {
                    "affix_group": "normal",
                    "code": "ColdDamage2",
                    "hover": "?s=Data%5CMods%2FColdDamage2",
                    "required_level": 20,
                    "families": ["ColdDamage"],
                    "text_html": "Adds <span class='mod-value'>(16-20)</span> to <span class='mod-value'>(25-31)</span> Cold Damage to Attacks",
                },
                {
                    "affix_group": "normal",
                    "code": "Unmapped1",
                    "hover": "?s=Data%5CMods%2FUnmapped1",
                    "required_level": 1,
                    "families": ["Unmapped"],
                    "text_html": "<span class='mod-value'>(1-2)</span> to Unmapped Stat",
                },
                {
                    "affix_group": "normal",
                    "code": "Unmapped2",
                    "hover": "?s=Data%5CMods%2FUnmapped2",
                    "required_level": 20,
                    "families": ["Unmapped"],
                    "text_html": "<span class='mod-value'>(3-4)</span> to Unmapped Stat",
                },
            ],
            "Belts": [
                {
                    "affix_group": "normal",
                    "code": "Strength1",
                    "hover": "?s=Data%5CMods%2FStrength1",
                    "required_level": 1,
                    "families": ["Strength"],
                    "text_html": "<span class='mod-value'>+(5-8)</span> to Strength",
                },
                {
                    "affix_group": "normal",
                    "code": "Strength2",
                    "hover": "?s=Data%5CMods%2FStrength2",
                    "required_level": 11,
                    "families": ["Strength"],
                    "text_html": "<span class='mod-value'>+(34-36)</span> to Strength",
                },
            ],
        }

        self.assertEqual(
            build_tier_mappings(affixes, trade_stat_index),
            {
                "Belts": {
                    "explicit.stat_strength": [
                        {"tier": 1, "exactMin": 34, "exactMax": 36, "min": 8.1},
                        {"tier": 2, "exactMin": 5, "exactMax": 8},
                    ]
                },
                "Rings": {
                    "explicit.stat_cold_damage": [
                        {"tier": 1, "exactMin": 20.5, "exactMax": 25.5, "min": 8.1},
                        {"tier": 2, "exactMin": 6, "exactMax": 8},
                    ],
                    "explicit.stat_strength": [
                        {"tier": 1, "exactMin": 13, "exactMax": 16, "min": 12.1},
                        {"tier": 2, "exactMin": 9, "exactMax": 12, "min": 8.1},
                        {"tier": 3, "exactMin": 5, "exactMax": 8},
                    ],
                },
            },
        )

    def test_uses_the_next_tier_roll_ceiling_for_the_minimum(self) -> None:
        affixes = {
            "Rings": [
                {
                    "affix_group": "normal",
                    "code": "AddedPhysicalDamage1",
                    "families": ["PhysicalDamage"],
                    "text_html": (
                        "Adds <span class='mod-value'>(10-15)</span> to "
                        "<span class='mod-value'>(18-26)</span> Physical Damage to Attacks"
                    ),
                },
                {
                    "affix_group": "normal",
                    "code": "AddedPhysicalDamage2",
                    "families": ["PhysicalDamage"],
                    "text_html": (
                        "Adds <span class='mod-value'>(12-19)</span> to "
                        "<span class='mod-value'>(22-32)</span> Physical Damage to Attacks"
                    ),
                },
            ]
        }

        self.assertEqual(
            build_tier_mappings(
                affixes,
                {"adds # to # physical damage to attacks": {"explicit.stat_physical_damage"}},
            ),
            {
                "Rings": {
                    "explicit.stat_physical_damage": [
                        {"tier": 1, "exactMin": 17, "exactMax": 25.5, "min": 20.6},
                        {"tier": 2, "exactMin": 14, "exactMax": 20.5},
                    ]
                }
            },
        )

    def test_preserves_localized_numeric_ranges_in_stat_templates(self) -> None:
        self.assertEqual(
            normalize_poe2db_localized_stat_template("羁绊：附加 14 - 20 基础物理伤害"),
            "羁绊：附加 # - # 基础物理伤害",
        )
        self.assertEqual(
            normalize_poe2db_localized_stat_template("命定:附加14至20物理傷害"),
            "命定:附加#至#物理傷害",
        )

    def test_builds_verified_modifier_localizations_from_stable_page_records(self) -> None:
        english_html = (
            '<a class="whiteitem SoulCore" data-hover="?s=Data%5CRune%5CTalisman" href="Legacy">Legacy</a>'
            '<div class="bondedMod"><a data-keyword="ShamanOnlyMods">Bonded</a>:</div>'
            '<div class="bondedMod"><a class="ItemClasses" href="Talismans">Talismans</a>: '
            'Enemies in your <a data-keyword="Presence">Presence</a> are '
            '<a data-keyword="Hinder">Hindered</a></div>'
            '<div class="implicitMod">Unblockable</div>'
        )
        simplified_html = (
            '<a class="whiteitem SoulCore" data-hover="?s=Data%5CRune%5CTalisman" href="Legacy">遗产</a>'
            '<div class="bondedMod"><a data-keyword="ShamanOnlyMods">羁绊</a>：</div>'
            '<div class="bondedMod"><a class="ItemClasses" href="Talismans">护符</a>：'
            '当你在场时，敌人受到<a data-keyword="Hinder">阻滞</a>效果</div>'
            '<div class="implicitMod">无法格挡</div>'
        )
        traditional_html = (
            '<a class="whiteitem SoulCore" data-hover="?s=Data%5CRune%5CTalisman" href="Legacy">遺產</a>'
            '<div class="bondedMod"><a data-keyword="ShamanOnlyMods">羈絆</a>：</div>'
            '<div class="bondedMod"><a class="ItemClasses" href="Talismans">護符</a>：'
            '你存在中的敵人被<a data-keyword="Hinder">阻礙</a></div>'
            '<div class="implicitMod">無法格擋</div>'
        )
        stats = {
            "rune.stat_presence": {
                "en": "Bonded: Enemies in your Presence are Hindered",
                "zh_CN": "Bonded: Enemies in your Presence are Hindered",
                "zh_TW": "Bonded: Enemies in your Presence are Hindered",
            },
            "implicit.stat_block": {
                "en": "Unblockable",
                "zh_CN": "Unblockable",
                "zh_TW": "Unblockable",
            },
        }

        localizations = build_verified_poe2db_stat_mod_localizations(
            stats,
            {
                "us": parse_poe2db_stat_source_records(english_html, "Runes"),
                "cn": parse_poe2db_stat_source_records(simplified_html, "Runes"),
                "tw": parse_poe2db_stat_source_records(traditional_html, "Runes"),
            },
        )

        self.assertEqual(
            localizations,
            {
                "Bonded: Enemies in your Presence are Hindered": {
                    "zh_CN": "羁绊：当你在场时，敌人受到阻滞效果",
                    "zh_TW": "羈絆：你存在中的敵人被阻礙",
                },
                "Unblockable": {"zh_CN": "无法格挡", "zh_TW": "無法格擋"},
            },
        )

    def test_builds_client_string_localizations_from_stable_ids(self) -> None:
        localizations = build_client_string_localizations(
            [
                {"Id": "HeistRequiresText", "Text": "Requires"},
                {"Id": "ItemNoteEditorOptionFixed", "Text": "Exact Price"},
            ],
            [
                {"Id": "HeistRequiresText", "Text": "需要"},
                {"Id": "ItemNoteEditorOptionFixed", "Text": "不二價"},
            ],
        )

        self.assertEqual(
            localizations,
            {
                "Exact Price": {"en": "Exact Price", "zh_CN": "Exact Price", "zh_TW": "不二價"},
                "Requires": {"en": "Requires", "zh_CN": "Requires", "zh_TW": "需要"},
            },
        )

    def test_skips_client_string_text_with_ambiguous_translations(self) -> None:
        localizations = build_client_string_localizations(
            [
                {"Id": "a", "Text": "Offline"},
                {"Id": "b", "Text": "Offline"},
            ],
            [
                {"Id": "a", "Text": "離線"},
                {"Id": "b", "Text": "不在線上"},
            ],
        )

        self.assertEqual(localizations, {})

    def test_builds_stat_group_labels_from_official_group_ids(self) -> None:
        groups = build_trade_stat_group_records(
            {"result": [{"id": "pseudo", "label": "Pseudo"}]},
            {"result": [{"id": "pseudo", "label": "综合"}]},
            {"result": [{"id": "pseudo", "label": "偽屬性"}]},
        )

        self.assertEqual(
            groups,
            {
                "pseudo": {
                    "en": "Pseudo",
                    "zh_CN": "综合",
                    "zh_TW": "偽屬性",
                }
            },
        )

    def test_parses_currency_item_links_from_official_base_item_types(self) -> None:
        html = (
            '<a class="item_currency StackableCurrency" '
            'data-hover="?s=Data%5CBaseItemTypes%2FMetadata%2FItems%2FCurrency%2FRune" '
            'href="Iron_Rune">Iron Rune</a>'
        )

        self.assertEqual(
            parse_poe2db_item_name_slugs(html),
            {"iron rune": ("Iron Rune", "Iron_Rune")},
        )

    def test_parses_keystone_links_only_when_requested(self) -> None:
        html = '<a class="PassiveSkills" href="Dance_with_Death">Dance with Death</a>'

        self.assertEqual(parse_poe2db_item_name_slugs(html), {})
        self.assertEqual(
            parse_poe2db_item_name_slugs(html, include_passive_skills=True),
            {"dance with death": ("Dance with Death", "Dance_with_Death")},
        )

    def test_applies_verified_poe2db_stat_titles_only_to_dual_locale_gaps(self) -> None:
        stats = {
            "explicit.keystone": {
                "en": "Ancestral Bond",
                "zh_CN": "Ancestral Bond",
                "zh_TW": "Ancestral Bond",
            },
            "explicit.official": {
                "en": "Existing Translation",
                "zh_CN": "已有翻译",
                "zh_TW": "Existing Translation",
            },
            "explicit.unverified": {
                "en": "Unknown Keystone",
                "zh_CN": "Unknown Keystone",
                "zh_TW": "Unknown Keystone",
            },
            "explicit.dance": {
                "en": "Dance With Death",
                "zh_CN": "Dance With Death",
                "zh_TW": "Dance With Death",
            },
        }

        applied = apply_verified_poe2db_stat_localizations(
            stats,
            {"Ancestral Bond": "Ancestral Bond", "Dance With Death": "Dance With Death"},
            {"Ancestral Bond": "先祖魂约", "Dance With Death": "与亡共舞"},
            {"Ancestral Bond": "先祖魂約", "Dance With Death": "與死共舞"},
            {"Dance With Death": {"zh_TW": "和死共舞"}},
        )

        self.assertEqual(applied, 2)
        self.assertEqual(stats["explicit.keystone"], {
            "en": "Ancestral Bond",
            "zh_CN": "先祖魂约",
            "zh_TW": "先祖魂約",
        })
        self.assertEqual(stats["explicit.official"]["zh_CN"], "已有翻译")
        self.assertEqual(stats["explicit.unverified"]["zh_CN"], "Unknown Keystone")
        self.assertEqual(stats["explicit.dance"], {
            "en": "Dance With Death",
            "zh_CN": "与亡共舞",
            "zh_TW": "和死共舞",
        })

    def test_composes_verified_runeforged_item_names_without_overwriting_official_names(self) -> None:
        items = {
            "Warden Bow": {"en": "Warden Bow", "zh_CN": "监守弓", "zh_TW": "守護者之弓"},
            "Runeforged Warden Bow": {
                "en": "Runeforged Warden Bow",
                "zh_CN": "Runeforged Warden Bow",
                "zh_TW": "Runeforged Warden Bow",
            },
            "Runeforged Official Bow": {
                "en": "Runeforged Official Bow",
                "zh_CN": "官方译名",
                "zh_TW": "官方譯名",
            },
        }

        applied = apply_verified_item_prefix_localizations(
            items,
            {"Runeforged ": {"zh_CN": "符锻", "zh_TW": "符鍛"}},
        )

        self.assertEqual(applied, 1)
        self.assertEqual(items["Runeforged Warden Bow"], {
            "en": "Runeforged Warden Bow",
            "zh_CN": "符锻监守弓",
            "zh_TW": "符鍛守護者之弓",
        })
        self.assertEqual(items["Runeforged Official Bow"]["zh_CN"], "官方译名")

    def test_builds_trade_localization_from_stable_api_identifiers(self) -> None:
        display_metadata = {
            "stats": {
                "explicit.stat_life": {
                    "en": "+# to maximum Life",
                    "zh_CN": "+# 生命上限",
                    "zh_TW": "+# 最大生命",
                }
            },
            "items": {
                "Rider Bow": {
                    "en": "Rider Bow",
                    "zh_CN": "骑射之弓",
                    "zh_TW": "騎士之弓",
                }
            },
        }
        english_static = {
            "result": {
                "currency": {
                    "label": "Currency",
                    "entries": [
                        {"id": "chaos", "text": "Chaos Orb"},
                        {"id": "rider", "text": "Rider Bow"},
                    ],
                }
            }
        }
        simplified_static = {
            "result": {
                "currency": {
                    "label": "通货",
                    "entries": [
                        {"id": "chaos", "text": "混沌石"},
                        {"id": "rider", "text": "Rider Bow"},
                    ],
                }
            }
        }
        traditional_static = {
            "result": {
                "currency": {
                    "label": "通貨",
                    "entries": [
                        {"id": "chaos", "text": "混沌石"},
                        {"id": "rider", "text": "Rider Bow"},
                    ],
                }
            }
        }
        english_filters = {
            "result": [
                {
                    "id": "type_filters",
                    "title": "Type Filters",
                    "filters": [
                        {
                            "id": "category",
                            "text": "Item Category",
                            "option": {"options": [{"id": "weapon.bow", "text": "Bow"}]},
                        }
                    ],
                }
            ]
        }
        simplified_filters = {
            "result": [
                {
                    "id": "type_filters",
                    "title": "类型过滤器",
                    "filters": [
                        {
                            "id": "category",
                            "text": "物品类型",
                            "option": {"options": [{"id": "weapon.bow", "text": "弓"}]},
                        }
                    ],
                }
            ]
        }
        traditional_filters = {
            "result": [
                {
                    "id": "type_filters",
                    "title": "類型過濾器",
                    "filters": [
                        {
                            "id": "category",
                            "text": "物品類型",
                            "option": {"options": [{"id": "weapon.bow", "text": "弓"}]},
                        }
                    ],
                }
            ]
        }

        metadata = build_trade_localization_metadata(
            display_metadata,
            english_static,
            simplified_static,
            traditional_static,
            english_filters,
            simplified_filters,
            traditional_filters,
        )

        self.assertEqual(
            metadata["strings"]["Item Category"],
            {"en": "Item Category", "zh_CN": "物品类型", "zh_TW": "物品類型"},
        )
        self.assertEqual(
            metadata["strings"]["Chaos Orb"],
            {"en": "Chaos Orb", "zh_CN": "混沌石", "zh_TW": "混沌石"},
        )
        self.assertEqual(
            metadata["strings"]["Rider Bow"],
            {"en": "Rider Bow", "zh_CN": "骑射之弓", "zh_TW": "騎士之弓"},
        )
        self.assertEqual(metadata["strings"]["+# to maximum Life"]["zh_CN"], "+# 生命上限")
        self.assertEqual(
            metadata["search"]["categories"],
            [{"id": "weapon.bow", "en": "Bow", "zh_CN": "弓", "zh_TW": "弓"}],
        )

    def test_builds_native_trade_search_localization_bundle(self) -> None:
        bundle = build_trade_item_localization_bundle(
            {
                "search": {
                    "items": [
                        {"en": "Gold Ring", "zh_CN": "金环", "zh_TW": "金環"},
                        {"en": "English Only", "zh_CN": "English Only", "zh_TW": "English Only"},
                    ],
                    "stats": [
                        {
                            "id": "explicit.stat_life",
                            "en": "+# to maximum Life",
                            "zh_CN": "+# 最大生命",
                            "zh_TW": "+# 最大生命"
                        }
                    ],
                },
                "strings": {
                    "Item Category": {"en": "Item Category", "zh_CN": "物品类型", "zh_TW": "道具分類"},
                    "English Only": {"en": "English Only", "zh_CN": "English Only", "zh_TW": "English Only"},
                },
            }
        )

        self.assertEqual(
            bundle,
            {
                "version": 5,
                "items": {
                    "Gold Ring": {"zh_CN": "金环", "zh_TW": "金環"},
                },
                "stats": {
                    "explicit.stat_life": {"zh_CN": "+# 最大生命", "zh_TW": "+# 最大生命"},
                },
                "strings": {
                    "Item Category": {"zh_CN": "物品类型", "zh_TW": "道具分類"},
                },
            },
        )

    def test_builds_missing_trade_filter_labels_from_verified_poe2db_pages(self) -> None:
        records = build_trade_filter_page_localizations(
            {
                "result": [
                    {
                        "id": "map_filters",
                        "filters": [
                            {"id": "map_magic_monsters", "text": "Monster Effectiveness"},
                            {"id": "map_rare_monsters", "text": "Monster Rarity"},
                        ],
                    }
                ]
            },
            {
                "map_magic_monsters": {"en": "Monster Effectiveness", "zh_CN": "怪物效能", "zh_TW": "怪物效用"},
                "map_rare_monsters": {"en": "Monster Rarity", "zh_CN": "怪物稀有度", "zh_TW": "怪物稀有度"},
            },
        )

        self.assertEqual(
            records,
            {
                "Monster Effectiveness": {
                    "en": "Monster Effectiveness",
                    "zh_CN": "怪物效能",
                    "zh_TW": "怪物效用",
                },
                "Monster Rarity": {
                    "en": "Monster Rarity",
                    "zh_CN": "怪物稀有度",
                    "zh_TW": "怪物稀有度",
                },
            },
        )

    def test_rejects_filter_page_localization_when_the_english_title_does_not_match(self) -> None:
        records = build_trade_filter_page_localizations(
            {
                "result": [
                    {
                        "id": "map_filters",
                        "filters": [{"id": "map_magic_monsters", "text": "Monster Effectiveness"}],
                    }
                ]
            },
            {
                "map_magic_monsters": {"en": "Unexpected title", "zh_CN": "怪物效能", "zh_TW": "怪物效用"},
            },
        )

        self.assertEqual(records, {})

    def test_builds_charm_category_from_its_stable_trade_id(self) -> None:
        records = build_trade_category_page_localizations(
            {
                "result": [
                    {
                        "id": "type_filters",
                        "filters": [
                            {
                                "id": "category",
                                "option": {"options": [{"id": "flask.charm", "text": "Charm"}]},
                            }
                        ],
                    }
                ]
            },
            {"flask.charm": {"en": "Charms", "zh_CN": "咒符", "zh_TW": "護符"}},
        )

        self.assertEqual(
            records,
            {"flask.charm": {"en": "Charm", "zh_CN": "咒符", "zh_TW": "護符"}},
        )

    def test_verified_charm_category_replaces_english_regional_api_fallback(self) -> None:
        filters = {
            "result": [
                {
                    "id": "type_filters",
                    "filters": [
                        {
                            "id": "category",
                            "option": {"options": [{"id": "flask.charm", "text": "Charm"}]},
                        }
                    ],
                }
            ]
        }
        metadata = build_trade_localization_metadata(
            {"stats": {}, "items": {}},
            {"result": {}},
            {"result": {}},
            {"result": {}},
            filters,
            filters,
            filters,
            supplemental_strings={"Charm": {"en": "Charm", "zh_CN": "咒符", "zh_TW": "護符"}},
            supplemental_categories={"flask.charm": {"en": "Charm", "zh_CN": "咒符", "zh_TW": "護符"}},
        )

        self.assertEqual(
            metadata["search"]["categories"],
            [{"id": "flask.charm", "en": "Charm", "zh_CN": "咒符", "zh_TW": "護符"}],
        )

    def test_verified_filter_page_translation_replaces_an_english_api_fallback(self) -> None:
        filters = {
            "result": [
                {
                    "id": "map_filters",
                    "filters": [{"id": "map_magic_monsters", "text": "Monster Effectiveness"}],
                }
            ]
        }
        metadata = build_trade_localization_metadata(
            {"stats": {}, "items": {}},
            {"result": {}},
            {"result": {}},
            {"result": {}},
            filters,
            filters,
            filters,
            {
                "Monster Effectiveness": {
                    "en": "Monster Effectiveness",
                    "zh_CN": "怪物效能",
                    "zh_TW": "怪物效用",
                }
            },
        )

        self.assertEqual(
            metadata["strings"]["Monster Effectiveness"],
            {"en": "Monster Effectiveness", "zh_CN": "怪物效能", "zh_TW": "怪物效用"},
        )

    def test_rejects_trade_localization_when_a_region_is_missing_stable_records(self) -> None:
        with self.assertRaises(TradeLocalizationCoverageError):
            build_trade_localization_metadata(
                {"stats": {}, "items": {}},
                {"result": {}},
                {"result": {}},
                {"result": {}},
                {
                    "result": [
                        {
                            "id": "type_filters",
                            "filters": [{"id": "category", "text": "Item Category"}],
                        }
                    ]
                },
                {"result": []},
                {"result": []},
            )

    def test_maps_unique_numeric_trade_item_names_without_relying_on_entry_order(self) -> None:
        english = {
            "result": [
                {
                    "id": "map",
                    "entries": [
                        {"type": "Waystone (Tier 1)"},
                        {"type": "Waystone (Tier 15)"},
                        {"type": "Target 9"},
                        {"type": "Unrequested 9"},
                    ],
                }
            ]
        }
        traditional = {
            "result": [
                {
                    "id": "map",
                    "entries": [
                        {"type": "換界石（階級 15）"},
                        {"type": "目標 9"},
                        {"type": "換界石（階級 1）"},
                    ],
                }
            ]
        }

        result = build_safe_numeric_trade_item_localizations(
            english,
            traditional,
            {"Waystone (Tier 1)", "Waystone (Tier 15)", "Target 9"},
        )

        self.assertEqual(
            result,
            {
                "Waystone (Tier 1)": "換界石（階級 1）",
                "Waystone (Tier 15)": "換界石（階級 15）",
            },
        )

    def test_builds_item_display_metadata_only_for_verified_translations(self) -> None:
        metadata = build_item_display_metadata(
            ["Rider Bow", "Fur Plate"],
            {"Rider Bow": "Rider Bow", "Fur Plate": "Fur Plate"},
            {"Rider Bow": "骑射之弓", "Fur Plate": "毛皮胸甲"},
            {"Rider Bow": "騎士之弓"},
            minimum_coverage=0.5,
        )

        self.assertEqual(
            metadata["items"]["Rider Bow"],
            {"en": "Rider Bow", "zh_CN": "骑射之弓", "zh_TW": "騎士之弓"},
        )
        self.assertEqual(
            metadata["items"]["Fur Plate"],
            {"en": "Fur Plate", "zh_CN": "毛皮胸甲", "zh_TW": "Fur Plate"},
        )
        self.assertEqual(metadata["coverage"]["zh_TW"], {"matched": 1, "total": 2, "ratio": 0.5})

    def test_builds_verified_currency_display_metadata(self) -> None:
        metadata = build_item_display_metadata(
            ["Iron Rune"],
            {"Iron Rune": "Iron Rune"},
            {"Iron Rune": "钢铁符文"},
            {"Iron Rune": "鍛鐵符文"},
        )

        self.assertEqual(
            metadata["items"]["Iron Rune"],
            {"en": "Iron Rune", "zh_CN": "钢铁符文", "zh_TW": "鍛鐵符文"},
        )

    def test_extracts_poe2db_item_title(self) -> None:
        self.assertEqual(
            parse_poe2db_item_title("<title>骑射之弓 - 流亡2编年史, Path of Exile Wiki cn</title>"),
            "骑射之弓",
        )

    def test_extracts_locale_independent_item_slugs_from_category_links(self) -> None:
        self.assertEqual(
            parse_poe2db_item_name_slugs(
                '<a class="whiteitem Bow" href="Rider_Bow">Rider Bow</a>'
                '<a class="whiteitem Bow" href="Rider_Bow"><img alt="Rider Bow"></a>'
            ),
            {"rider bow": ("Rider Bow", "Rider_Bow")},
        )

    def test_builds_display_metadata_from_exact_and_safe_bare_stat_matches(self) -> None:
        english = {
            "result": [
                {
                    "id": "explicit",
                    "entries": [
                        {"id": "explicit.stat_exact", "text": "+# to maximum Life"},
                        {"id": "explicit.stat_shared", "text": "#% increased Attack Speed"},
                        {"id": "crafted.stat_shared", "text": "#% increased Attack Speed"},
                        {"id": "fractured.stat_shared", "text": "#% increased Attack Speed"},
                        {"id": "fractured.stat_ambiguous", "text": "+# to Strength"},
                        {"id": "explicit.stat_ambiguous", "text": "+# to Dexterity"},
                    ],
                }
            ]
        }
        traditional = {
            "result": [
                {
                    "id": "explicit",
                    "entries": [
                        {"id": "explicit.stat_exact", "text": "+# 最大生命"},
                        {"id": "fractured.stat_shared", "text": "#% 攻擊速度提高"},
                        {"id": "crafted.stat_ambiguous", "text": "+# 力量"},
                        {"id": "desecrated.stat_ambiguous", "text": "+# 敏捷"},
                    ],
                }
            ]
        }
        simplified = {
            "result": [
                {
                    "id": "explicit",
                    "entries": [
                        {"id": "explicit.stat_exact", "text": "+# 生命上限"},
                        {"id": "fractured.stat_shared", "text": "#% 攻击速度提高"},
                    ],
                }
            ]
        }

        metadata = build_display_metadata(
            english,
            simplified,
            traditional,
            {"explicit.stat_exact", "explicit.stat_shared", "crafted.stat_shared", "fractured.stat_ambiguous"},
            minimum_coverage=0.5,
        )

        self.assertEqual(
            metadata["stats"]["explicit.stat_exact"],
            {
                "en": "+# to maximum Life",
                "zh_CN": "+# 生命上限",
                "zh_TW": "+# 最大生命",
                "sources": {"zh_CN": "exact_id", "zh_TW": "exact_id"},
            },
        )
        self.assertEqual(metadata["stats"]["crafted.stat_shared"]["zh_TW"], "#% 攻擊速度提高")
        self.assertEqual(metadata["stats"]["crafted.stat_shared"]["sources"]["zh_TW"], "same_bare_and_template")
        self.assertEqual(metadata["stats"]["fractured.stat_ambiguous"]["zh_TW"], "+# to Strength")
        self.assertEqual(metadata["stats"]["fractured.stat_ambiguous"]["sources"]["zh_TW"], "fallback")
        self.assertEqual(metadata["coverage"]["zh_CN"]["matched"], 3)
        self.assertEqual(metadata["coverage"]["zh_TW"]["matched"], 3)

    def test_rejects_display_metadata_below_minimum_coverage(self) -> None:
        english = {"result": [{"id": "explicit", "entries": [{"id": "explicit.stat_life", "text": "+# to maximum Life"}]}]}
        missing = {"result": []}

        with self.assertRaises(DisplayMetadataCoverageError):
            build_display_metadata(
                english,
                missing,
                missing,
                {"explicit.stat_life"},
                minimum_coverage=0.95,
            )

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

    def test_maps_base_item_mods_to_official_trade_stats(self) -> None:
        trade_stats_payload = {
            "result": [
                {
                    "id": "implicit",
                    "entries": [
                        {
                            "id": "implicit.stat_adds_irradiated",
                            "text": "Adds Irradiated to a Map # use remaining",
                        }
                    ],
                },
                {
                    "id": "explicit",
                    "entries": [
                        {"id": "explicit.stat_unique_only", "text": "Only on a unique item"}
                    ],
                },
            ]
        }
        page_artifacts = {
            "Any_Base_Item": parse_page_html_artifacts(
                """
                <div class="Stats">
                  <div class="implicitMod">Adds Irradiated to a Map <br/><span>10</span> uses remaining</div>
                </div>
                <div id="Unique">
                  <div class="explicitMod">Only on a unique item</div>
                </div>
                """
            )
        }

        patterns_by_slug, stat_ids_by_slug = collect_base_item_mod_stat_artifacts(
            page_artifacts,
            build_trade_stat_index(trade_stats_payload),
            build_trade_stat_records(trade_stats_payload),
        )

        self.assertEqual(
            patterns_by_slug,
            {"Any_Base_Item": ["Adds Irradiated to a Map # use remaining"]},
        )
        self.assertEqual(stat_ids_by_slug, {"Any_Base_Item": ["implicit.stat_adds_irradiated"]})

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
