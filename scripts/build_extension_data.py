#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from poe2_scraper import build_async_client, fetch_text, page_slug_from_url, strip_html


NUMBER_RE = re.compile(r"([-+]?\d+(?:\.\d+)?)")
WHITESPACE_RE = re.compile(r"\s+")
HTML_BREAK_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
HTML_TITLE_RE = re.compile(r"<title\b[^>]*>(.*?)</title\s*>", re.IGNORECASE | re.DOTALL)
GRANTED_SKILL_RE = re.compile(r"\bGrants\s+Skill:\s*(?:Level\s+(?:#|\d+)\s*)?(.+?)\s*$", re.IGNORECASE)
TRADE_STATS_URL = "https://www.pathofexile.com/api/trade2/data/stats"
TRADE_ITEMS_URL = "https://www.pathofexile.com/api/trade2/data/items"
TRADE_STATS_ZH_CN_URL = "https://poe.game.qq.com/api/trade2/data/stats"
TRADE_STATS_ZH_TW_URL = "https://pathofexile.tw/api/trade2/data/stats"
TRADE_ITEMS_ZH_CN_URL = "https://poe.game.qq.com/api/trade2/data/items"
TRADE_ITEMS_ZH_TW_URL = "https://pathofexile.tw/api/trade2/data/items"
TRADE_STATIC_URL = "https://www.pathofexile.com/api/trade2/data/static"
TRADE_STATIC_ZH_CN_URL = "https://poe.game.qq.com/api/trade2/data/static"
TRADE_STATIC_ZH_TW_URL = "https://pathofexile.tw/api/trade2/data/static"
TRADE_FILTERS_URL = "https://www.pathofexile.com/api/trade2/data/filters"
TRADE_FILTERS_ZH_CN_URL = "https://poe.game.qq.com/api/trade2/data/filters"
TRADE_FILTERS_ZH_TW_URL = "https://pathofexile.tw/api/trade2/data/filters"
POE2DB_ITEM_ROOT_URL = "https://poe2db.tw/us/"
CLIENT_STRINGS_URL = "https://raw.githubusercontent.com/LocalIdentity/poe2-data/main/data/clientstrings.json"
CLIENT_STRINGS_ZH_TW_URL = (
    "https://raw.githubusercontent.com/LocalIdentity/poe2-data/main/"
    "data/traditional%20chinese/clientstrings.json"
)
TRADE_ITEM_LOCALIZATION_PAGE_SLUGS = (
    "Stackable_Currency",
    "Augment",
    "Omen",
    "Incubators",
    "Liquid_Emotions",
    "Essence",
    "Splinter",
    "Catalysts",
    "Map_Fragments",
    "Inscribed_Ultimatum",
    "Trial_Coins",
    "Pinnacle_Keys",
    "Jewels",
    "Vault_Keys",
    "Relics",
    "Strongbox",
    "Life_Flasks",
    "Mana_Flasks",
    "Charms",
    "Gem",
    "Skill_Gems",
    "Support_Gems",
    "Meta_Skill_Gem",
    "Spirit_Gems",
    "Lineage_Supports",
    "Cultivated",
    "Waystones",
    "Hideout",
    "Hideout_Doodads",
    "Quest",
    "Tablet",
)
# Keystone pages provide verified localized titles for passive stat entries the
# regional Trade APIs still leave in English.
TRADE_STAT_LOCALIZATION_PAGE_SLUGS = ("Keystone",)
# These pages expose localized modifier text associated with stable game-data
# paths. They supplement only Trade stat IDs that both regional APIs leave in
# English.
TRADE_STAT_LOCALIZATION_MOD_PAGE_SLUGS = ("Runes", "One_Hand_Axes", "Flails")
# The page title uses a different but semantically equivalent Taiwanese term.
# Keep the user-approved Trade spelling after the upstream page identity is
# verified through its English, simplified, and traditional titles.
TRADE_STAT_LOCALIZATION_OVERRIDES = {
    "Dance With Death": {"zh_TW": "和死共舞"},
}
TRADE_ITEM_PREFIX_LOCALIZATIONS = {
    "Runeforged ": {"zh_CN": "符锻", "zh_TW": "符鍛"},
}
# The regional Trade APIs leave these labels in English. The page slugs are
# stable PoE2DB concepts, while the localized title remains source data.
TRADE_FILTER_LOCALIZATION_PAGE_SLUGS = {
    "map_magic_monsters": "Monster_Effectiveness",
    "map_rare_monsters": "Monster_Rarity",
}
# The official category option ID is the stable identity. Its PoE2DB page uses
# a plural English title, so title-text equality is intentionally not used.
TRADE_CATEGORY_LOCALIZATION_PAGE_SLUGS = {
    "flask.charm": "Charms",
}
TRADE_STAT_WILDCARD_PLACEHOLDERS = {
    "azmeri spirit",
}
HTML_VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
PLURAL_NORMALIZATION_STOP_WORDS = {
    "as",
    "chaos",
    "has",
    "is",
    "less",
    "loss",
    "this",
}

WEAPON_PAGE_SLUGS = [
    "Claws",
    "Daggers",
    "Wands",
    "One_Hand_Swords",
    "One_Hand_Axes",
    "One_Hand_Maces",
    "Sceptres",
    "Spears",
    "Flails",
    "Bows",
    "Staves",
    "Two_Hand_Swords",
    "Two_Hand_Axes",
    "Two_Hand_Maces",
    "Quarterstaves",
    "Crossbows",
    "Traps",
    "Talismans",
]
ACCESSORY_PAGE_SLUGS = ["Amulets", "Rings", "Belts"]
GLOVE_PAGE_SLUGS = [
    "Gloves_str",
    "Gloves_dex",
    "Gloves_int",
    "Gloves_str_dex",
    "Gloves_str_int",
    "Gloves_dex_int",
]
BOOT_PAGE_SLUGS = [
    "Boots_str",
    "Boots_dex",
    "Boots_int",
    "Boots_str_dex",
    "Boots_str_int",
    "Boots_dex_int",
]
BODY_ARMOUR_PAGE_SLUGS = [
    "Body_Armours_str",
    "Body_Armours_dex",
    "Body_Armours_int",
    "Body_Armours_str_dex",
    "Body_Armours_str_int",
    "Body_Armours_dex_int",
    "Body_Armours_str_dex_int",
]
HELMET_PAGE_SLUGS = [
    "Helmets_str",
    "Helmets_dex",
    "Helmets_int",
    "Helmets_str_dex",
    "Helmets_str_int",
    "Helmets_dex_int",
]
SHIELD_PAGE_SLUGS = ["Shields_str", "Shields_str_dex", "Shields_str_int"]
OFF_HAND_PAGE_SLUGS = ["Quivers", *SHIELD_PAGE_SLUGS, "Bucklers", "Foci"]
ARMOUR_PAGE_SLUGS = [
    *GLOVE_PAGE_SLUGS,
    *BOOT_PAGE_SLUGS,
    *BODY_ARMOUR_PAGE_SLUGS,
    *HELMET_PAGE_SLUGS,
    *OFF_HAND_PAGE_SLUGS,
]
JEWEL_PAGE_SLUGS = [
    "Ruby",
    "Emerald",
    "Sapphire",
    "Diamond",
    "Time-Lost_Ruby",
    "Time-Lost_Emerald",
    "Time-Lost_Sapphire",
    "Time-Lost_Diamond",
]
FLASK_PAGE_SLUGS = ["Life_Flasks", "Mana_Flasks", "Charms"]
RELIC_PAGE_SLUGS = [
    "Relics",
    "Urn_Relic",
    "Amphora_Relic",
    "Vase_Relic",
    "Seal_Relic",
    "Coffer_Relic",
    "Tapestry_Relic",
    "Incense_Relic",
]
WAYSTONE_PAGE_SLUGS = [
    "Waystones_low_tier",
    "Waystones_mid_tier",
    "Waystones_top_tier",
]
EXTRA_PAGE_ITEM_NAMES = {
    "Waystones_low_tier": [f"Waystone (Tier {tier})" for tier in range(1, 6)],
    "Waystones_mid_tier": [f"Waystone (Tier {tier})" for tier in range(6, 11)],
    "Waystones_top_tier": [f"Waystone (Tier {tier})" for tier in range(11, 17)],
}
PAGE_ITEM_NAME_CLASS_FILTERS = {
    "Charms": "UtilityFlask",
}
EXTRA_PAGE_ALLOWED_TRADE_STAT_TEXTS = {
    "Charms": [
        "#% increased Duration (Charm)",
        "#% increased Charm Effect Duration",
        "#% increased Charm Charges gained",
        "#% reduced Charm Charges used",
        "Charms gain # charge per Second",
    ],
}
LOCALIZED_ITEM_NAME_SELECTION_OVERRIDES = {
    "探险日志": {"kind": "logical", "id": "Maps"},
    "探險日誌": {"kind": "logical", "id": "Maps"},
}
TABLET_PAGE_SLUGS = [
    "Breach_Tablet",
    "Expedition_Tablet",
    "Delirium_Tablet",
    "Ritual_Tablet",
    "Irradiated_Tablet",
    "Overseer_Tablet",
    "Abyss_Tablet",
    "Temple_Tablet",
]
POE2DB_ITEM_NAME_FALLBACK_EXCLUDED_PAGE_SLUGS = {
    *WAYSTONE_PAGE_SLUGS,
    *TABLET_PAGE_SLUGS,
    "Inscribed_Ultimatum",
}

LOGICAL_CATEGORY_SPECS = {
    "Weapons": {
        "label": "Weapons",
        "aliases": ["Weapons", "Weapon"],
        "page_slugs": WEAPON_PAGE_SLUGS,
    },
    "One Handed Weapons": {
        "label": "One Handed Weapons",
        "aliases": ["One Handed Weapons", "One Hand Weapons"],
        "page_slugs": WEAPON_PAGE_SLUGS[:9],
    },
    "Two Handed Weapons": {
        "label": "Two Handed Weapons",
        "aliases": ["Two Handed Weapons", "Two Hand Weapons"],
        "page_slugs": WEAPON_PAGE_SLUGS[9:],
    },
    "Accessories": {
        "label": "Accessories",
        "aliases": ["Accessories", "Accessory"],
        "page_slugs": ACCESSORY_PAGE_SLUGS,
    },
    "Jewellery": {
        "label": "Jewellery",
        "aliases": ["Jewellery", "Jewelry"],
        "page_slugs": ["Amulets", "Rings"],
    },
    "Armour": {
        "label": "Armour",
        "aliases": ["Armour", "Armor"],
        "page_slugs": ARMOUR_PAGE_SLUGS,
    },
    "Gloves": {
        "label": "Gloves",
        "aliases": ["Gloves", "Glove"],
        "page_slugs": GLOVE_PAGE_SLUGS,
    },
    "Boots": {
        "label": "Boots",
        "aliases": ["Boots", "Boot"],
        "page_slugs": BOOT_PAGE_SLUGS,
    },
    "Body Armours": {
        "label": "Body Armours",
        "aliases": ["Body Armours", "Body Armour", "Body Armors", "Body Armor"],
        "page_slugs": BODY_ARMOUR_PAGE_SLUGS,
    },
    "Helmets": {
        "label": "Helmets",
        "aliases": ["Helmets", "Helmet"],
        "page_slugs": HELMET_PAGE_SLUGS,
    },
    "Off-hand": {
        "label": "Off-hand",
        "aliases": ["Off-hand", "Offhand", "Off Hand"],
        "page_slugs": OFF_HAND_PAGE_SLUGS,
    },
    "Shields": {
        "label": "Shields",
        "aliases": ["Shields", "Shield"],
        "page_slugs": SHIELD_PAGE_SLUGS,
    },
    "Jewels": {
        "label": "Jewels",
        "aliases": ["Jewels", "Jewel"],
        "page_slugs": JEWEL_PAGE_SLUGS,
    },
    "Flasks": {
        "label": "Flasks",
        "aliases": ["Flasks", "Flask"],
        "page_slugs": FLASK_PAGE_SLUGS,
    },
    "Relics": {
        "label": "Relics",
        "aliases": ["Relics", "Relic"],
        "page_slugs": RELIC_PAGE_SLUGS,
    },
    "Tablets": {
        "label": "Tablets",
        "aliases": ["Tablets", "Tablet"],
        "page_slugs": TABLET_PAGE_SLUGS,
    },
    "Waystones": {
        "label": "Waystones",
        "aliases": ["Waystones", "Waystone", "Maps", "Map"],
        "page_slugs": WAYSTONE_PAGE_SLUGS,
    },
    "Strongboxes": {
        "label": "Strongboxes",
        "aliases": ["Strongboxes", "Strongbox"],
        "page_slugs": ["Strongbox"],
    },
    "Ultimatums": {
        "label": "Ultimatums",
        "aliases": ["Ultimatums", "Ultimatum", "Inscribed Ultimatum"],
        "page_slugs": ["Inscribed_Ultimatum"],
    },
    "Sanctum": {
        "label": "Sanctum",
        "aliases": ["Sanctum"],
        "page_slugs": RELIC_PAGE_SLUGS,
    },
    "Maps": {
        "label": "Maps",
        "aliases": ["Maps", "Map"],
        "page_slugs": [*WAYSTONE_PAGE_SLUGS, *TABLET_PAGE_SLUGS],
    },
}
TRADE_ITEM_GROUP_TO_LOGICAL_CATEGORY = {
    "accessory": "Accessories",
    "armour": "Armour",
    "flask": "Flasks",
    "jewel": "Jewels",
    "map": "Maps",
    "sanctum": "Sanctum",
    "weapon": "Weapons",
}
TRADE_ITEM_GROUPS_WITH_TRUSTED_PAGE_ITEM_NAMES = {
    "accessory",
    "armour",
    "flask",
    "jewel",
    "sanctum",
    "weapon",
}


@dataclass
class PageArtifacts:
    page_slug: str
    page_group: str | None
    page_url: str
    baseitem_name: str
    allowed_patterns: list[str]
    allowed_stat_ids: list[str]
    item_names: list[str]


@dataclass
class PageHtmlArtifacts:
    item_names: list[str]
    granted_skill_names: list[str]
    base_item_mod_texts: list[str]
    item_mod_texts: list[str]


@dataclass(frozen=True)
class Poe2dbStatSourceRecord:
    page_slug: str
    item_key: str
    section: str
    text: str
    item_class_key: str
    keyword_keys: tuple[str, ...]
    is_bonded_header: bool


@dataclass(frozen=True)
class TradeStatRecord:
    key: str
    pattern: str
    stat_id: str


class DisplayMetadataCoverageError(ValueError):
    """Raised when build-time localized metadata is too incomplete to ship."""


class TradeLocalizationCoverageError(ValueError):
    """Raised when official regional Trade data cannot be safely aligned."""


class Poe2dbPageArtifactsParser(HTMLParser):
    def __init__(self, item_class_code: str | None = None) -> None:
        super().__init__()
        self.item_class_code = item_class_code
        self.capture_anchor = False
        self.current_text: list[str] = []
        self.item_names: list[str] = []
        self.capture_implicit_depth = 0
        self.current_implicit_text: list[str] = []
        self.current_implicit_has_granted_skill_icon = False
        self.granted_skill_names: list[str] = []
        self.capture_item_mod_depth = 0
        self.current_item_mod_text: list[str] = []
        self.item_mod_texts: list[str] = []
        self.capture_base_stats_depth = 0
        self.capture_base_item_mod_depth = 0
        self.current_base_item_mod_text: list[str] = []
        self.base_item_mod_texts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        class_tokens = (attrs_dict.get("class", "") or "").split()
        if self.capture_item_mod_depth > 0 and tag not in HTML_VOID_TAGS:
            self.capture_item_mod_depth += 1
        if tag == "div" and {"implicitMod", "explicitMod"}.intersection(class_tokens):
            self.capture_item_mod_depth = 1
            self.current_item_mod_text = []

        if self.capture_base_stats_depth > 0 and tag not in HTML_VOID_TAGS:
            self.capture_base_stats_depth += 1
        elif tag == "div" and "Stats" in class_tokens:
            self.capture_base_stats_depth = 1

        if self.capture_base_item_mod_depth > 0 and tag not in HTML_VOID_TAGS:
            self.capture_base_item_mod_depth += 1
        elif (
            self.capture_base_stats_depth > 0
            and tag == "div"
            and {"implicitMod", "explicitMod"}.intersection(class_tokens)
        ):
            self.capture_base_item_mod_depth = 1
            self.current_base_item_mod_text = []

        if self.capture_implicit_depth > 0:
            self.record_granted_skill_icon(tag, attrs_dict)
            if tag not in HTML_VOID_TAGS:
                self.capture_implicit_depth += 1

        if tag == "div" and "implicitMod" in class_tokens:
            self.capture_implicit_depth = 1
            self.current_implicit_text = []
            self.current_implicit_has_granted_skill_icon = False

        if tag != "a":
            return
        class_name = attrs_dict.get("class", "") or ""
        class_tokens = class_name.split()
        if "whiteitem" in class_tokens and (
            not self.item_class_code or self.item_class_code in class_tokens
        ):
            self.capture_anchor = True
            self.current_text = []

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.capture_implicit_depth > 0:
            self.record_granted_skill_icon(tag, dict(attrs))

    def handle_endtag(self, tag: str) -> None:
        if self.capture_item_mod_depth > 0:
            self.capture_item_mod_depth -= 1
            if self.capture_item_mod_depth == 0:
                self.finish_item_mod()

        if self.capture_base_item_mod_depth > 0:
            self.capture_base_item_mod_depth -= 1
            if self.capture_base_item_mod_depth == 0:
                self.finish_base_item_mod()

        if self.capture_base_stats_depth > 0:
            self.capture_base_stats_depth -= 1

        if self.capture_implicit_depth > 0:
            self.capture_implicit_depth -= 1
            if self.capture_implicit_depth == 0:
                self.finish_implicit_mod()

        if tag != "a" or not self.capture_anchor:
            return
        text = strip_html("".join(self.current_text))
        if text:
            self.item_names.append(text)
        self.capture_anchor = False
        self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.capture_anchor:
            self.current_text.append(data)
        if self.capture_item_mod_depth > 0:
            self.current_item_mod_text.append(data)
        if self.capture_base_item_mod_depth > 0:
            self.current_base_item_mod_text.append(data)
        if self.capture_implicit_depth > 0:
            self.current_implicit_text.append(data)

    def record_granted_skill_icon(self, tag: str, attrs_dict: dict[str, str | None]) -> None:
        if tag != "img":
            return
        class_name = attrs_dict.get("class", "") or ""
        if "grantsSkill" in class_name.split():
            self.current_implicit_has_granted_skill_icon = True

    def finish_implicit_mod(self) -> None:
        if not self.current_implicit_has_granted_skill_icon:
            self.current_implicit_text = []
            return

        text = WHITESPACE_RE.sub(" ", "".join(self.current_implicit_text)).strip()
        skill_name = extract_granted_skill_name(text)
        if skill_name:
            self.granted_skill_names.append(skill_name)
        self.current_implicit_text = []

    def finish_item_mod(self) -> None:
        text = WHITESPACE_RE.sub(" ", "".join(self.current_item_mod_text)).strip()
        if text:
            self.item_mod_texts.append(text)
        self.current_item_mod_text = []

    def finish_base_item_mod(self) -> None:
        text = WHITESPACE_RE.sub(" ", "".join(self.current_base_item_mod_text)).strip()
        if text:
            self.base_item_mod_texts.append(text)
        self.current_base_item_mod_text = []


class Poe2dbStatSourceParser(HTMLParser):
    """Parse localized item modifiers keyed by their stable PoE2DB source path."""

    def __init__(self, page_slug: str) -> None:
        super().__init__()
        self.page_slug = page_slug
        self.current_item_key = ""
        self.capture_depth = 0
        self.capture_section = ""
        self.capture_text: list[str] = []
        self.capture_item_class_key = ""
        self.capture_keyword_keys: list[str] = []
        self.records: list[Poe2dbStatSourceRecord] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        class_tokens = (attrs_dict.get("class") or "").split()
        if tag == "a" and "whiteitem" in class_tokens:
            self.current_item_key = str(attrs_dict.get("href") or attrs_dict.get("data-hover") or "").strip()

        if self.capture_depth > 0:
            if tag == "br":
                self.capture_text.append(" ")
            if tag == "a":
                keyword = str(attrs_dict.get("data-keyword") or "").strip()
                if keyword:
                    self.capture_keyword_keys.append(keyword)
                if "ItemClasses" in class_tokens:
                    item_class_key = str(attrs_dict.get("href") or attrs_dict.get("data-hover") or "").strip()
                    if item_class_key:
                        self.capture_item_class_key = item_class_key
            if tag not in HTML_VOID_TAGS:
                self.capture_depth += 1
            return

        if tag != "div":
            return
        section = next(
            (candidate for candidate in ("implicitMod", "explicitMod", "bondedMod") if candidate in class_tokens),
            "",
        )
        if not section or not self.current_item_key:
            return
        self.capture_depth = 1
        self.capture_section = section
        self.capture_text = []
        self.capture_item_class_key = ""
        self.capture_keyword_keys = []

    def handle_endtag(self, tag: str) -> None:
        if self.capture_depth <= 0:
            return
        self.capture_depth -= 1
        if self.capture_depth == 0:
            self.finish_record()

    def handle_data(self, data: str) -> None:
        if self.capture_depth > 0:
            self.capture_text.append(data)

    def finish_record(self) -> None:
        text = WHITESPACE_RE.sub(" ", "".join(self.capture_text)).strip()
        keyword_keys = tuple(self.capture_keyword_keys)
        is_bonded_header = self.capture_section == "bondedMod" and "ShamanOnlyMods" in keyword_keys
        if text:
            self.records.append(
                Poe2dbStatSourceRecord(
                    page_slug=self.page_slug,
                    item_key=self.current_item_key,
                    section=self.capture_section,
                    text=text,
                    item_class_key=self.capture_item_class_key,
                    keyword_keys=keyword_keys,
                    is_bonded_header=is_bonded_header,
                )
            )
        self.capture_section = ""
        self.capture_text = []
        self.capture_item_class_key = ""
        self.capture_keyword_keys = []


def parse_poe2db_stat_source_records(html: str, page_slug: str) -> list[Poe2dbStatSourceRecord]:
    parser = Poe2dbStatSourceParser(page_slug)
    parser.feed(html)
    return list(dict.fromkeys(parser.records))


def poe2db_stat_source_identity(record: Poe2dbStatSourceRecord) -> tuple[str, str, str, str, tuple[str, ...]]:
    return (
        record.page_slug,
        record.item_key,
        record.section,
        record.item_class_key,
        record.keyword_keys,
    )


def poe2db_stat_source_structural_identity(record: Poe2dbStatSourceRecord) -> tuple[str, str, str, str]:
    return (record.page_slug, record.item_key, record.section, record.item_class_key)


def strip_poe2db_stat_scope(text: str) -> str:
    """Drop a page-only item-class prefix without altering the rendered stat."""

    match = re.match(r"^[^:：]{1,100}[:：]\s*(.+)$", str(text or "").strip())
    return match.group(1).strip() if match else str(text or "").strip()


def normalize_poe2db_localized_stat_template(text: str) -> str:
    """Replace source values with placeholders without collapsing local grammar."""

    value = strip_html(text).replace("−", "-").replace("–", "-").replace("—", "-")
    value = NUMBER_RE.sub("#", value)
    return WHITESPACE_RE.sub(" ", value).strip()


def poe2db_stat_source_text(record: Poe2dbStatSourceRecord, strip_scope: bool) -> str:
    if record.is_bonded_header:
        return ""
    text = strip_poe2db_stat_scope(record.text) if strip_scope else record.text
    return f"Bonded: {text}" if record.section == "bondedMod" else text


def build_verified_poe2db_stat_mod_localizations(
    stats: dict[str, dict[str, str]],
    records_by_locale: dict[str, list[Poe2dbStatSourceRecord]],
) -> dict[str, dict[str, str]]:
    """Build localizations only when all locales agree on a stable page record.

    The page's internal item path, modifier section, item class and keyword path
    identify a modifier across languages. English text is used only to select the
    official Trade stat; it is never used to derive Chinese text.
    """

    requested = {
        canonicalize_match_key(str(record.get("en") or "")): str(record.get("en") or "").strip()
        for record in stats.values()
        if record.get("en")
        and record.get("zh_CN") == record.get("en")
        and record.get("zh_TW") == record.get("en")
    }
    requested.pop("", None)
    if not requested:
        return {}

    records_by_identity: dict[str, dict[tuple[str, str, str, str, tuple[str, ...]], list[Poe2dbStatSourceRecord]]] = {}
    records_by_structure: dict[str, dict[tuple[str, str, str, str], list[Poe2dbStatSourceRecord]]] = {}
    bonded_headers: dict[str, dict[tuple[str, str], list[Poe2dbStatSourceRecord]]] = {}
    for locale, records in records_by_locale.items():
        identity_index: dict[tuple[str, str, str, str, tuple[str, ...]], list[Poe2dbStatSourceRecord]] = {}
        structure_index: dict[tuple[str, str, str, str], list[Poe2dbStatSourceRecord]] = {}
        header_index: dict[tuple[str, str], list[Poe2dbStatSourceRecord]] = {}
        for record in records:
            if record.is_bonded_header:
                header_index.setdefault((record.page_slug, record.item_key), []).append(record)
            else:
                identity_index.setdefault(poe2db_stat_source_identity(record), []).append(record)
                structure_index.setdefault(poe2db_stat_source_structural_identity(record), []).append(record)
        records_by_identity[locale] = identity_index
        records_by_structure[locale] = structure_index
        bonded_headers[locale] = header_index

    candidates: dict[str, dict[str, set[str]]] = {}
    for english_record in records_by_locale.get("us", []):
        if english_record.is_bonded_header:
            continue
        for strip_scope in (False, True):
            english = poe2db_stat_source_text(english_record, strip_scope)
            matched_english = requested.get(canonicalize_match_key(english))
            if not matched_english:
                continue
            localized_values: dict[str, str] = {}
            source_identity = poe2db_stat_source_identity(english_record)
            for source_locale, target_locale in (("cn", "zh_CN"), ("tw", "zh_TW")):
                localized_records = records_by_identity.get(source_locale, {}).get(source_identity, [])
                if not localized_records:
                    localized_records = records_by_structure.get(source_locale, {}).get(
                        poe2db_stat_source_structural_identity(english_record),
                        [],
                    )
                if len(localized_records) != 1:
                    break
                localized_record = localized_records[0]
                localized_text = poe2db_stat_source_text(localized_record, strip_scope)
                if localized_record.section == "bondedMod":
                    headers = bonded_headers.get(source_locale, {}).get(
                        (localized_record.page_slug, localized_record.item_key),
                        [],
                    )
                    if len(headers) != 1:
                        break
                    content = strip_poe2db_stat_scope(localized_record.text) if strip_scope else localized_record.text
                    localized_text = f"{headers[0].text}{content}"
                localized_values[target_locale] = normalize_poe2db_localized_stat_template(localized_text)
            if len(localized_values) != 2 or any(not value for value in localized_values.values()):
                continue
            record = candidates.setdefault(matched_english, {"zh_CN": set(), "zh_TW": set()})
            for locale, value in localized_values.items():
                record[locale].add(value)

    return {
        english: {
            "zh_CN": next(iter(values["zh_CN"])),
            "zh_TW": next(iter(values["zh_TW"])),
        }
        for english, values in candidates.items()
        if len(values["zh_CN"]) == 1 and len(values["zh_TW"]) == 1
        and next(iter(values["zh_CN"])) != english
        and next(iter(values["zh_TW"])) != english
    }


class Poe2dbItemLinkParser(HTMLParser):
    def __init__(self, include_passive_skills: bool = False) -> None:
        super().__init__()
        self.include_passive_skills = include_passive_skills
        self.items: dict[str, tuple[str, str]] = {}
        self.capture_href: str | None = None
        self.current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a" or self.capture_href is not None:
            return
        attrs_dict = dict(attrs)
        classes = (attrs_dict.get("class") or "").split()
        hover_source = str(attrs_dict.get("data-hover") or "")
        if (
            "whiteitem" not in classes
            and "BaseItemTypes" not in hover_source
            and not (self.include_passive_skills and "PassiveSkills" in classes)
        ):
            return
        href = str(attrs_dict.get("href") or "").strip()
        if not href or href.startswith(("?", "http://", "https://")):
            return
        self.capture_href = href
        self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.capture_href is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self.capture_href is None:
            return
        name = WHITESPACE_RE.sub(" ", "".join(self.current_text)).strip()
        slug = self.capture_href.rstrip("/").rsplit("/", 1)[-1]
        if name and slug:
            self.items.setdefault(normalize_lookup_text(name), (name, slug))
        self.capture_href = None
        self.current_text = []


def humanize_slug(slug: str) -> str:
    return slug.replace("_", " ")


def poe2db_item_slug(item_name: str) -> str:
    without_apostrophes = re.sub(r"['’]", "", item_name)
    return re.sub(r"[^\w-]+", "_", without_apostrophes).strip("_")


def normalize_lookup_text(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text).strip().lower()


def canonicalize_stat_text(text: str) -> str:
    text = strip_html(text)
    text = text.replace("−", "-").replace("–", "-").replace("—", "-")
    text = NUMBER_RE.sub("#", text)
    text = re.sub(r"\(\s*#\s*-\s*#\s*\)", "#", text)
    text = re.sub(r"#\s*-\s*#", "#", text)
    text = text.replace("+#", "#")
    text = text.replace("(#)", "#")
    text = text.replace("(##)", "#")
    text = text.replace("##", "#")
    text = re.sub(r"(^|[\s(])%", r"\1#%", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def canonicalize_match_key(text: str) -> str:
    return canonicalize_stat_text(text).lower()


def plural_normalized_match_key(text: str) -> str:
    key = canonicalize_match_key(text)
    return re.sub(r"[a-z]+", lambda match: singularize_token(match.group(0)), key)


def singularize_token(token: str) -> str:
    if token in PLURAL_NORMALIZATION_STOP_WORDS or len(token) <= 3:
        return token
    if token.endswith("uses"):
        return token[:-1]
    if token.endswith("ies") and len(token) > 4:
        return f"{token[:-3]}y"
    if token.endswith(("ses", "xes", "zes", "ches", "shes")):
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us", "ous", "is")):
        return token[:-1]
    return token


def trade_stat_lookup_keys(text: str) -> set[str]:
    exact = canonicalize_match_key(text)
    if not exact:
        return set()
    return {exact, plural_normalized_match_key(exact)}


def split_affix_stat_lines(text_html: str) -> list[str]:
    text = HTML_BREAK_RE.sub("\n", str(text_html or ""))
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = HTML_TAG_RE.sub("", raw_line)
        line = unescape(line).replace("\xa0", " ")
        line = WHITESPACE_RE.sub(" ", line).strip()
        if line:
            lines.append(line)
    return lines


def parse_page_html_artifacts(html: str, item_class_code: str | None = None) -> PageHtmlArtifacts:
    parser = Poe2dbPageArtifactsParser(item_class_code)
    parser.feed(html)
    return PageHtmlArtifacts(
        item_names=dedupe_preserve_order(parser.item_names),
        granted_skill_names=dedupe_preserve_order(parser.granted_skill_names),
        base_item_mod_texts=dedupe_preserve_order(parser.base_item_mod_texts),
        item_mod_texts=dedupe_preserve_order(parser.item_mod_texts),
    )


def extract_granted_skill_name(text: str) -> str:
    match = GRANTED_SKILL_RE.search(strip_html(text))
    if not match:
        return ""
    return WHITESPACE_RE.sub(" ", match.group(1)).strip()


def granted_skill_lookup_keys(skill_name: str) -> set[str]:
    normalized = normalize_lookup_text(skill_name)
    if not normalized:
        return set()

    keys = {normalized}
    keys.add(re.sub(r"[a-z]+", lambda match: singularize_token(match.group(0)), normalized))
    if normalized.endswith(" minion"):
        without_minion = normalized[: -len(" minion")].strip()
        keys.add(without_minion)
        keys.add(re.sub(r"[a-z]+", lambda match: singularize_token(match.group(0)), without_minion))
    keys.discard("")
    return keys


def build_trade_stat_index(trade_stats_payload: dict[str, Any]) -> dict[str, set[str]]:
    index: dict[str, set[str]] = {}
    for group in trade_stats_payload.get("result", []):
        for entry in group.get("entries", []):
            stat_id = entry.get("id")
            text = entry.get("text")
            if not stat_id or not text:
                continue
            for key in trade_stat_lookup_keys(text):
                index.setdefault(key, set()).add(stat_id)
    return index


def build_trade_stat_records(trade_stats_payload: dict[str, Any]) -> list[TradeStatRecord]:
    records: list[TradeStatRecord] = []
    for group in trade_stats_payload.get("result", []):
        for entry in group.get("entries", []):
            stat_id = entry.get("id")
            text = entry.get("text")
            if not stat_id or not text:
                continue
            pattern = canonicalize_stat_text(text)
            for key in trade_stat_lookup_keys(text):
                records.append(TradeStatRecord(key=key, pattern=pattern, stat_id=stat_id))
    return records


def build_trade_stat_text_map(trade_stats_payload: dict[str, Any]) -> dict[str, str]:
    text_by_id: dict[str, str] = {}
    for group in trade_stats_payload.get("result", []):
        for entry in group.get("entries", []):
            stat_id = str(entry.get("id") or "").strip()
            text = str(entry.get("text") or "").strip()
            if stat_id and text and stat_id not in text_by_id:
                text_by_id[stat_id] = text
    return text_by_id


def build_client_string_localizations(
    english_payload: list[dict[str, Any]],
    traditional_payload: list[dict[str, Any]],
) -> dict[str, dict[str, str]]:
    """Map client UI copy through stable ClientStrings IDs without guessing duplicates."""

    traditional_by_id = {
        str(record.get("Id") or "").strip(): str(record.get("Text") or "").strip()
        for record in traditional_payload
        if str(record.get("Id") or "").strip() and str(record.get("Text") or "").strip()
    }
    candidates: dict[str, set[str]] = {}
    for record in english_payload:
        record_id = str(record.get("Id") or "").strip()
        english = str(record.get("Text") or "").strip()
        traditional = traditional_by_id.get(record_id, "")
        if record_id and english and traditional:
            candidates.setdefault(english, set()).add(traditional)

    return {
        english: {"en": english, "zh_CN": english, "zh_TW": next(iter(translations))}
        for english, translations in sorted(candidates.items())
        if len(translations) == 1
    }


def build_trade_stat_group_records(
    english_payload: dict[str, Any],
    simplified_payload: dict[str, Any],
    traditional_payload: dict[str, Any],
) -> dict[str, dict[str, str]]:
    """Align visible Trade stat group labels using the official group IDs."""

    def labels_by_id(payload: dict[str, Any]) -> dict[str, str]:
        return {
            group_id: label
            for group in payload.get("result", [])
            if (group_id := str(group.get("id") or "").strip())
            and (label := str(group.get("label") or "").strip())
        }

    english_labels = labels_by_id(english_payload)
    simplified_labels = labels_by_id(simplified_payload)
    traditional_labels = labels_by_id(traditional_payload)
    return {
        group_id: {
            "en": english,
            "zh_CN": simplified_labels.get(group_id, english),
            "zh_TW": traditional_labels.get(group_id, english),
        }
        for group_id, english in sorted(english_labels.items())
    }


def trade_stat_bare_id(stat_id: str) -> str:
    value = str(stat_id or "").strip()
    return value.split(".", 1)[1] if "." in value else value


def build_display_metadata(
    english_payload: dict[str, Any],
    simplified_payload: dict[str, Any],
    traditional_payload: dict[str, Any],
    supported_stat_ids: set[str],
    minimum_coverage: float = 0.95,
) -> dict[str, Any]:
    """Create deterministic localized stat text with conservative bare-ID reuse.

    The regional APIs expose many, but not all, of the international full IDs.
    A fallback may only cross source prefixes when the international English template
    for both IDs is identical after canonicalization.
    """

    english_by_id = build_trade_stat_text_map(english_payload)
    requested_ids = sorted(stat_id for stat_id in supported_stat_ids if stat_id in english_by_id)
    region_payloads = {"zh_CN": simplified_payload, "zh_TW": traditional_payload}
    stats: dict[str, dict[str, Any]] = {}
    coverage: dict[str, dict[str, Any]] = {}

    for locale, payload in region_payloads.items():
        region_by_id = build_trade_stat_text_map(payload)
        candidates_by_bare: dict[str, list[tuple[str, str]]] = {}
        for candidate_id, candidate_text in region_by_id.items():
            english_candidate = english_by_id.get(candidate_id)
            if not english_candidate:
                continue
            candidates_by_bare.setdefault(trade_stat_bare_id(candidate_id), []).append((candidate_id, candidate_text))

        matched = 0
        exact = 0
        reused = 0
        for stat_id in requested_ids:
            record = stats.setdefault(
                stat_id,
                {
                    "en": english_by_id[stat_id],
                    "zh_CN": english_by_id[stat_id],
                    "zh_TW": english_by_id[stat_id],
                    "sources": {},
                },
            )
            localized = region_by_id.get(stat_id)
            source = "exact_id" if localized else "fallback"
            if localized:
                exact += 1
            else:
                english_key = canonicalize_match_key(english_by_id[stat_id])
                valid_texts = {
                    candidate_text
                    for candidate_id, candidate_text in candidates_by_bare.get(trade_stat_bare_id(stat_id), [])
                    if canonicalize_match_key(english_by_id[candidate_id]) == english_key
                }
                if len(valid_texts) == 1:
                    localized = valid_texts.pop()
                    source = "same_bare_and_template"
                    reused += 1
            if source != "fallback":
                matched += 1
            record[locale] = localized or english_by_id[stat_id]
            record["sources"][locale] = source

        denominator = len(requested_ids)
        ratio = matched / denominator if denominator else 1.0
        coverage[locale] = {
            "matched": matched,
            "total": denominator,
            "ratio": round(ratio, 6),
            "exactId": exact,
            "sameBareAndTemplate": reused,
        }
        if ratio < minimum_coverage:
            raise DisplayMetadataCoverageError(
                f"{locale} localized stat coverage {ratio:.2%} is below the required {minimum_coverage:.2%} "
                f"({matched}/{denominator})"
            )

    return {"stats": stats, "coverage": coverage}


def parse_poe2db_item_title(html: str) -> str:
    match = HTML_TITLE_RE.search(str(html or ""))
    if not match:
        return ""
    title = WHITESPACE_RE.sub(" ", unescape(strip_html(match.group(1)))).strip()
    return title.rsplit(" - ", 1)[0].strip() if " - " in title else title


def parse_poe2db_item_name_slugs(
    html: str,
    include_passive_skills: bool = False,
) -> dict[str, tuple[str, str]]:
    parser = Poe2dbItemLinkParser(include_passive_skills=include_passive_skills)
    parser.feed(html)
    return parser.items


def build_item_display_metadata(
    item_names: list[str],
    english_names: dict[str, str],
    simplified_names: dict[str, str],
    traditional_names: dict[str, str],
    minimum_coverage: float = 0.95,
) -> dict[str, Any]:
    items: dict[str, dict[str, str]] = {}
    coverage: dict[str, dict[str, Any]] = {}
    requested_names = sorted({str(name).strip() for name in item_names if str(name).strip()})
    verified_names = [name for name in requested_names if english_names.get(name) == name]

    for name in verified_names:
        items[name] = {
            "en": name,
            "zh_CN": simplified_names.get(name) or name,
            "zh_TW": traditional_names.get(name) or name,
        }

    for locale, names in (("zh_CN", simplified_names), ("zh_TW", traditional_names)):
        matched = sum(1 for name in verified_names if names.get(name))
        total = len(requested_names)
        ratio = matched / total if total else 1.0
        coverage[locale] = {"matched": matched, "total": total, "ratio": round(ratio, 6)}
        if ratio < minimum_coverage:
            raise DisplayMetadataCoverageError(
                f"{locale} localized item coverage {ratio:.2%} is below the required {minimum_coverage:.2%} "
                f"({matched}/{total})"
            )
    return {"items": items, "coverage": coverage}


TRADE_LOCALIZATION_TEXT_FIELDS = ("text", "label", "title", "placeholder", "tip")


def collect_static_trade_text_records(payload: dict[str, Any]) -> dict[str, str]:
    """Collect text from static Trade data using only object keys and stable IDs.

    Some Trade payload arrays contain entries without IDs. Their position is not an
    identity, so they are intentionally excluded instead of being aligned by index.
    """

    records: dict[str, str] = {}

    def walk(value: Any, path: tuple[str, ...]) -> None:
        if isinstance(value, dict):
            identifier = str(value.get("id") or "").strip()
            current_path = (*path, f"id={identifier}") if identifier else path
            for field in TRADE_LOCALIZATION_TEXT_FIELDS:
                text = value.get(field)
                if isinstance(text, str) and text.strip():
                    records["/".join((*current_path, field))] = text.strip()
            for key, child in value.items():
                if key in TRADE_LOCALIZATION_TEXT_FIELDS or key == "id":
                    continue
                if isinstance(child, dict):
                    walk(child, (*current_path, key))
                elif isinstance(child, list):
                    for entry in child:
                        if isinstance(entry, dict) and str(entry.get("id") or "").strip():
                            walk(entry, (*current_path, key))

    walk(payload.get("result"), ("result",))
    return records


def collect_filter_trade_text_records(
    payload: dict[str, Any],
) -> tuple[dict[str, str], list[tuple[str, str]]]:
    """Collect filter copy and category option text keyed by official filter IDs."""

    records: dict[str, str] = {}
    categories: list[tuple[str, str]] = []
    for group in payload.get("result", []):
        group_id = str(group.get("id") or "").strip()
        if not group_id:
            continue
        group_path = f"group={group_id}"
        title = group.get("title")
        if isinstance(title, str) and title.strip():
            records[f"{group_path}/title"] = title.strip()
        for filter_data in group.get("filters", []):
            filter_id = str(filter_data.get("id") or "").strip()
            if not filter_id:
                continue
            filter_path = f"{group_path}/filter={filter_id}"
            for field in ("text", "title", "placeholder", "tip"):
                text = filter_data.get(field)
                if isinstance(text, str) and text.strip():
                    records[f"{filter_path}/{field}"] = text.strip()
            options = filter_data.get("option", {}).get("options", [])
            for option in options:
                option_id = option.get("id")
                option_text = option.get("text")
                if not isinstance(option_text, str) or not option_text.strip():
                    continue
                option_key = "null" if option_id is None else str(option_id).strip()
                if not option_key:
                    continue
                record_key = f"{filter_path}/option={option_key}/text"
                records[record_key] = option_text.strip()
                if group_id == "type_filters" and filter_id == "category":
                    categories.append((option_key, option_text.strip()))
    return records, categories


def collect_trade_filter_text_by_id(payload: dict[str, Any]) -> dict[str, str]:
    """Index visible Trade filter labels by their official filter ID."""

    labels: dict[str, str] = {}
    for group in payload.get("result", []):
        for filter_data in group.get("filters", []):
            filter_id = str(filter_data.get("id") or "").strip()
            text = str(filter_data.get("text") or "").strip()
            if filter_id and text:
                labels[filter_id] = text
    return labels


def build_trade_filter_page_localizations(
    english_filters_payload: dict[str, Any],
    page_titles: dict[str, dict[str, str]],
) -> dict[str, dict[str, str]]:
    """Build extra Trade filter labels only after title identity is verified."""

    english_by_id = collect_trade_filter_text_by_id(english_filters_payload)
    records: dict[str, dict[str, str]] = {}
    for filter_id in TRADE_FILTER_LOCALIZATION_PAGE_SLUGS:
        english = english_by_id.get(filter_id, "")
        titles = page_titles.get(filter_id) or {}
        if not english or titles.get("en") != english:
            continue
        simplified = str(titles.get("zh_CN") or "").strip()
        traditional = str(titles.get("zh_TW") or "").strip()
        if simplified and traditional:
            records[english] = {
                "en": english,
                "zh_CN": simplified,
                "zh_TW": traditional,
            }
    return records


def build_trade_category_page_localizations(
    english_filters_payload: dict[str, Any],
    page_titles: dict[str, dict[str, str]],
) -> dict[str, dict[str, str]]:
    """Build category labels from a stable Trade category ID and verified page titles."""

    english_categories = dict(collect_filter_trade_text_records(english_filters_payload)[1])
    records: dict[str, dict[str, str]] = {}
    for category_id in TRADE_CATEGORY_LOCALIZATION_PAGE_SLUGS:
        english = english_categories.get(category_id, "")
        titles = page_titles.get(category_id) or {}
        simplified = str(titles.get("zh_CN") or "").strip()
        traditional = str(titles.get("zh_TW") or "").strip()
        if english and simplified and traditional:
            records[category_id] = {
                "en": english,
                "zh_CN": simplified,
                "zh_TW": traditional,
            }
    return records


def build_trade_localization_metadata(
    display_metadata: dict[str, Any],
    english_static_payload: dict[str, Any],
    simplified_static_payload: dict[str, Any],
    traditional_static_payload: dict[str, Any],
    english_filters_payload: dict[str, Any],
    simplified_filters_payload: dict[str, Any],
    traditional_filters_payload: dict[str, Any],
    supplemental_strings: dict[str, dict[str, str]] | None = None,
    minimum_coverage: float = 0.95,
    supplemental_categories: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Build the rendered-text and cross-language search bundle for Trade.

    IDs are retained by the official Trade client. The output is keyed by the
    international English text only after regional strings have been aligned by
    those IDs, so runtime localization never needs to modify request payloads.
    """

    candidates: dict[str, dict[str, set[str]]] = {}
    coverage: dict[str, dict[str, int]] = {
        "zh_CN": {"matched": 0, "total": 0},
        "zh_TW": {"matched": 0, "total": 0},
    }

    def add_record(
        english: str,
        simplified: str,
        traditional: str,
        prefer_over_english: bool = False,
    ) -> None:
        en = str(english or "").strip()
        if not en:
            return
        record = candidates.setdefault(en, {"zh_CN": set(), "zh_TW": set()})
        for locale, localized in (("zh_CN", simplified), ("zh_TW", traditional)):
            coverage[locale]["total"] += 1
            value = str(localized or "").strip()
            if value:
                coverage[locale]["matched"] += 1
                if value == en and record[locale] and record[locale] != {en}:
                    continue
                if prefer_over_english and record[locale] == {en}:
                    record[locale].clear()
                record[locale].add(value)

    stat_search: list[dict[str, str]] = []
    for stat_id, record in (display_metadata.get("stats") or {}).items():
        english = str(record.get("en") or "").strip()
        simplified = str(record.get("zh_CN") or english).strip()
        traditional = str(record.get("zh_TW") or english).strip()
        add_record(english, simplified, traditional)
        if english:
            stat_search.append(
                {"id": str(stat_id), "en": english, "zh_CN": simplified, "zh_TW": traditional}
            )

    for record in (display_metadata.get("statGroups") or {}).values():
        add_record(record.get("en", ""), record.get("zh_CN", ""), record.get("zh_TW", ""))

    item_search: list[dict[str, str]] = []
    for item_name, record in (display_metadata.get("items") or {}).items():
        english = str(record.get("en") or item_name).strip()
        simplified = str(record.get("zh_CN") or english).strip()
        traditional = str(record.get("zh_TW") or english).strip()
        add_record(english, simplified, traditional)
        if english:
            item_search.append(
                {"id": english, "en": english, "zh_CN": simplified, "zh_TW": traditional}
            )

    sources = (
        (
            collect_static_trade_text_records(english_static_payload),
            collect_static_trade_text_records(simplified_static_payload),
            collect_static_trade_text_records(traditional_static_payload),
        ),
        (
            collect_filter_trade_text_records(english_filters_payload)[0],
            collect_filter_trade_text_records(simplified_filters_payload)[0],
            collect_filter_trade_text_records(traditional_filters_payload)[0],
        ),
    )
    for english_records, simplified_records, traditional_records in sources:
        for key, english in english_records.items():
            add_record(english, simplified_records.get(key, ""), traditional_records.get(key, ""))

    for english, record in (supplemental_strings or {}).items():
        add_record(
            english,
            record.get("zh_CN", ""),
            record.get("zh_TW", ""),
            prefer_over_english=True,
        )

    english_categories = collect_filter_trade_text_records(english_filters_payload)[1]
    simplified_filter_records, _ = collect_filter_trade_text_records(simplified_filters_payload)
    traditional_filter_records, _ = collect_filter_trade_text_records(traditional_filters_payload)
    category_search: list[dict[str, str]] = []
    for category_id, english in english_categories:
        key = f"group=type_filters/filter=category/option={category_id}/text"
        simplified = simplified_filter_records.get(key, "")
        traditional = traditional_filter_records.get(key, "")
        supplemental_category = (supplemental_categories or {}).get(category_id) or {}
        if supplemental_category.get("en") == english:
            if simplified == english:
                simplified = supplemental_category.get("zh_CN", "")
            if traditional == english:
                traditional = supplemental_category.get("zh_TW", "")
        if simplified and traditional:
            category_search.append(
                {"id": category_id, "en": english, "zh_CN": simplified, "zh_TW": traditional}
            )

    ratios: dict[str, dict[str, Any]] = {}
    for locale, values in coverage.items():
        total = values["total"]
        matched = values["matched"]
        ratio = matched / total if total else 1.0
        ratios[locale] = {"matched": matched, "total": total, "ratio": round(ratio, 6)}
        if ratio < minimum_coverage:
            raise TradeLocalizationCoverageError(
                f"{locale} Trade localization coverage {ratio:.2%} is below the required "
                f"{minimum_coverage:.2%} ({matched}/{total})"
            )

    strings: dict[str, dict[str, str]] = {}
    for english, localized_values in candidates.items():
        simplified = localized_values["zh_CN"]
        traditional = localized_values["zh_TW"]
        # A visible English label may legitimately occur in several API sections.
        # Ship it only when every stable source agrees on its localized spelling.
        if len(simplified) != 1 or len(traditional) != 1:
            continue
        strings[english] = {
            "en": english,
            "zh_CN": next(iter(simplified)),
            "zh_TW": next(iter(traditional)),
        }

    def dedupe_search(entries: list[dict[str, str]]) -> list[dict[str, str]]:
        unique: dict[tuple[str, str], dict[str, str]] = {}
        for entry in entries:
            unique.setdefault((entry["id"], entry["en"]), entry)
        return sorted(unique.values(), key=lambda entry: (entry["en"].lower(), entry["id"]))

    return {
        "version": 1,
        "strings": dict(sorted(strings.items())),
        "clientStrings": display_metadata.get("clientStrings") or {},
        "search": {
            "items": dedupe_search(item_search),
            "stats": dedupe_search(stat_search),
            "categories": dedupe_search(category_search),
        },
        "coverage": ratios,
    }


def build_trade_item_localization_bundle(trade_localization: dict[str, Any]) -> dict[str, Any]:
    """Emit compact, ID-safe labels for native Trade search data."""

    items: dict[str, dict[str, str]] = {}
    for record in trade_localization.get("search", {}).get("items", []):
        english = str(record.get("en") or "").strip()
        simplified = str(record.get("zh_CN") or english).strip()
        traditional = str(record.get("zh_TW") or english).strip()
        if english and (simplified != english or traditional != english):
            items[english] = {"zh_CN": simplified, "zh_TW": traditional}

    stats: dict[str, dict[str, str]] = {}
    for record in trade_localization.get("search", {}).get("stats", []):
        stat_id = str(record.get("id") or "").strip()
        english = str(record.get("en") or "").strip()
        simplified = str(record.get("zh_CN") or english).strip()
        traditional = str(record.get("zh_TW") or english).strip()
        if stat_id and english and (simplified != english or traditional != english):
            stats[stat_id] = {"zh_CN": simplified, "zh_TW": traditional}

    strings: dict[str, dict[str, str]] = {}
    for english, record in (trade_localization.get("strings") or {}).items():
        key = str(english or "").strip()
        simplified = str(record.get("zh_CN") or key).strip()
        traditional = str(record.get("zh_TW") or key).strip()
        if key and (simplified != key or traditional != key):
            strings[key] = {"zh_CN": simplified, "zh_TW": traditional}

    return {
        "version": 5,
        "items": dict(sorted(items.items())),
        "stats": dict(sorted(stats.items())),
        "strings": dict(sorted(strings.items())),
    }


def apply_verified_poe2db_stat_localizations(
    stats: dict[str, dict[str, str]],
    verified_english_names: dict[str, str],
    simplified_names: dict[str, str],
    traditional_names: dict[str, str],
    overrides: dict[str, dict[str, str]] | None = None,
) -> int:
    """Fill only dual-locale stat gaps from a PoE2DB page verified in all locales."""

    applied = 0
    for record in stats.values():
        english = str(record.get("en") or "").strip()
        if (
            not english
            or record.get("zh_CN") != english
            or record.get("zh_TW") != english
            or verified_english_names.get(english) != english
        ):
            continue
        simplified = str(simplified_names.get(english) or "").strip()
        traditional = str(traditional_names.get(english) or "").strip()
        if not simplified or not traditional:
            continue
        override = (overrides or {}).get(english) or {}
        record["zh_CN"] = str(override.get("zh_CN") or simplified).strip()
        record["zh_TW"] = str(override.get("zh_TW") or traditional).strip()
        applied += 1
    return applied


def apply_verified_item_prefix_localizations(
    items: dict[str, dict[str, str]],
    prefixes: dict[str, dict[str, str]],
) -> int:
    """Compose a localized item prefix only when its base name is verified."""

    applied = 0
    for record in items.values():
        english = str(record.get("en") or "").strip()
        if not english or record.get("zh_CN") != english or record.get("zh_TW") != english:
            continue
        for prefix, localized_prefixes in prefixes.items():
            if not english.startswith(prefix):
                continue
            base = items.get(english[len(prefix) :].strip())
            if not base:
                continue
            simplified = str(base.get("zh_CN") or "").strip()
            traditional = str(base.get("zh_TW") or "").strip()
            if not simplified or not traditional or simplified == base.get("en") or traditional == base.get("en"):
                continue
            record["zh_CN"] = f'{localized_prefixes["zh_CN"]}{simplified}'
            record["zh_TW"] = f'{localized_prefixes["zh_TW"]}{traditional}'
            applied += 1
            break
    return applied


def build_safe_numeric_trade_item_localizations(
    english_payload: dict[str, Any],
    localized_payload: dict[str, Any],
    requested_names: set[str],
) -> dict[str, str]:
    """Match localized names only when a stable group and numeric signature are unique.

    Regional trade item payloads do not provide per-entry identifiers, so matching
    list positions would be unsafe. Numeric signatures let generated parameterized
    names use the official localized item data without guessing at list order.
    """

    localized_groups = {
        str(group.get("id") or ""): group.get("entries") or []
        for group in localized_payload.get("result", [])
        if group.get("id")
    }
    candidates: dict[str, set[str]] = {}

    def index_entries(entries: list[Any]) -> dict[tuple[str, ...], list[str]]:
        indexed: dict[tuple[str, ...], list[str]] = {}
        for entry in entries:
            item_name = str(entry.get("type") or "").strip() if isinstance(entry, dict) else ""
            if not item_name:
                continue
            signature = tuple(NUMBER_RE.findall(item_name))
            if signature:
                indexed.setdefault(signature, []).append(item_name)
        return indexed

    for english_group in english_payload.get("result", []):
        group_id = str(english_group.get("id") or "")
        localized_entries = localized_groups.get(group_id)
        if not group_id or not isinstance(localized_entries, list):
            continue
        english_by_signature = index_entries(english_group.get("entries") or [])
        localized_by_signature = index_entries(localized_entries)
        for signature, english_names in english_by_signature.items():
            localized_names = localized_by_signature.get(signature, [])
            if english_names[0] in requested_names and len(english_names) == 1 and len(localized_names) == 1:
                candidates.setdefault(english_names[0], set()).add(localized_names[0])

    return {name: next(iter(names)) for name, names in candidates.items() if len(names) == 1}


def build_trade_stat_universe(trade_stats_payload: dict[str, Any]) -> tuple[list[str], list[str]]:
    patterns: set[str] = set()
    stat_ids: set[str] = set()
    for group in trade_stats_payload.get("result", []):
        for entry in group.get("entries", []):
            stat_id = entry.get("id")
            text = entry.get("text")
            if not stat_id or not text:
                continue
            pattern = canonicalize_stat_text(text)
            if pattern:
                patterns.add(pattern)
            stat_ids.add(stat_id)
    return sorted(patterns), sorted(stat_ids)


def build_trade_skill_stat_index(trade_stats_payload: dict[str, Any]) -> dict[str, set[tuple[str, str]]]:
    index: dict[str, set[tuple[str, str]]] = {}
    for group in trade_stats_payload.get("result", []):
        if group.get("id") != "skill":
            continue
        for entry in group.get("entries", []):
            stat_id = entry.get("id")
            text = entry.get("text")
            if not stat_id or not text:
                continue
            skill_name = extract_granted_skill_name(text)
            if not skill_name:
                continue
            pattern = canonicalize_stat_text(text)
            for key in granted_skill_lookup_keys(skill_name):
                index.setdefault(key, set()).add((pattern, stat_id))
    return index


def map_granted_skill_names_to_trade_stats(
    skill_names: list[str],
    trade_skill_stat_index: dict[str, set[tuple[str, str]]],
) -> tuple[list[str], list[str]]:
    patterns: set[str] = set()
    stat_ids: set[str] = set()
    for skill_name in skill_names:
        for key in granted_skill_lookup_keys(skill_name):
            for pattern, stat_id in trade_skill_stat_index.get(key, set()):
                patterns.add(pattern)
                stat_ids.add(stat_id)
    return sorted(patterns), sorted(stat_ids)


def map_affix_text_to_trade_stat_ids(text_html: str, trade_stat_index: dict[str, set[str]]) -> tuple[list[str], list[str]]:
    patterns: list[str] = []
    stat_ids: set[str] = set()
    for line in split_affix_stat_lines(text_html):
        pattern = canonicalize_stat_text(line)
        if not pattern:
            continue
        patterns.append(pattern)
        for key in trade_stat_lookup_keys(pattern):
            stat_ids.update(trade_stat_index.get(key, set()))
    return patterns, sorted(stat_ids)


def map_trade_stat_texts_to_trade_stat_ids(
    trade_stat_texts: list[str],
    trade_stat_index: dict[str, set[str]],
    trade_stat_records: list[TradeStatRecord] | None = None,
    include_unmatched_patterns: bool = True,
) -> tuple[list[str], list[str]]:
    patterns: set[str] = set()
    stat_ids: set[str] = set()
    for trade_stat_text in trade_stat_texts:
        pattern = canonicalize_stat_text(trade_stat_text)
        if not pattern:
            continue
        matched_stat_ids: set[str] = set()
        for key in trade_stat_lookup_keys(pattern):
            matched_stat_ids.update(trade_stat_index.get(key, set()))
        wildcard_match_re = build_trade_stat_wildcard_match_re(pattern)
        if wildcard_match_re:
            for record in trade_stat_records or []:
                if wildcard_match_re.match(record.key):
                    patterns.add(record.pattern)
                    matched_stat_ids.add(record.stat_id)
        if include_unmatched_patterns or matched_stat_ids:
            patterns.add(pattern)
        stat_ids.update(matched_stat_ids)
    return sorted(patterns), sorted(stat_ids)


def build_trade_stat_wildcard_match_re(pattern: str) -> re.Pattern[str] | None:
    key = canonicalize_match_key(pattern)
    if "[" not in key or "]" not in key:
        return None
    placeholders = [placeholder.strip().lower() for placeholder in re.findall(r"\[([^\]]+)\]", key)]
    if not placeholders or any(placeholder not in TRADE_STAT_WILDCARD_PLACEHOLDERS for placeholder in placeholders):
        return None
    parts = re.split(r"\[[^\]]+\]", key)
    if any(not part for part in parts):
        return None
    return re.compile(r"^" + r".+".join(re.escape(part) for part in parts) + r"$")


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            output.append(value)
    return output


def merge_extra_artifacts(*artifacts_by_slug: dict[str, list[str]]) -> dict[str, list[str]]:
    merged: dict[str, set[str]] = {}
    for artifacts in artifacts_by_slug:
        for page_slug, values in artifacts.items():
            merged.setdefault(page_slug, set()).update(values)
    return {page_slug: sorted(values) for page_slug, values in merged.items()}


async def fetch_page_item_names(page_url: str, item_class_code: str | None = None) -> list[str]:
    async with build_async_client(max_connections=1) as client:
        html = await fetch_text(client, page_url)
    return parse_page_html_artifacts(html, item_class_code).item_names


async def collect_item_names(page_urls: list[str], workers: int) -> dict[str, list[str]]:
    page_artifacts_by_slug = await collect_page_html_artifacts(
        page_urls,
        workers,
        PAGE_ITEM_NAME_CLASS_FILTERS,
    )
    return {slug: page_artifacts.item_names for slug, page_artifacts in page_artifacts_by_slug.items()}


async def collect_page_html_artifacts(
    page_urls: list[str],
    workers: int,
    item_class_codes_by_slug: dict[str, str | None] | None = None,
) -> dict[str, PageHtmlArtifacts]:
    semaphore = asyncio.Semaphore(max(1, workers))
    item_class_codes_by_slug = item_class_codes_by_slug or {}

    async def task(page_url: str, client: Any) -> tuple[str, PageHtmlArtifacts]:
        async with semaphore:
            html = await fetch_text(client, page_url)
        page_slug = page_slug_from_url(page_url)
        return page_slug, parse_page_html_artifacts(
            html,
            item_class_codes_by_slug.get(page_slug),
        )

    async with build_async_client(max_connections=max(1, workers)) as client:
        tasks = [task(page_url, client) for page_url in page_urls]
        results = await asyncio.gather(*tasks)
    return dict(results)


def map_item_mod_texts_to_trade_stats(
    item_mod_texts: list[str],
    trade_stat_index: dict[str, set[str]],
    trade_stat_records: list[TradeStatRecord],
) -> tuple[list[str], list[str]]:
    _, stat_ids = map_trade_stat_texts_to_trade_stat_ids(
        item_mod_texts,
        trade_stat_index,
        trade_stat_records,
        include_unmatched_patterns=False,
    )
    patterns = sorted({record.pattern for record in trade_stat_records if record.stat_id in stat_ids})
    return patterns, stat_ids


def collect_base_item_mod_stat_artifacts(
    page_html_artifacts_by_slug: dict[str, PageHtmlArtifacts],
    trade_stat_index: dict[str, set[str]],
    trade_stat_records: list[TradeStatRecord],
) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    patterns_by_slug: dict[str, list[str]] = {}
    stat_ids_by_slug: dict[str, list[str]] = {}
    for page_slug, page_html_artifacts in page_html_artifacts_by_slug.items():
        patterns, stat_ids = map_item_mod_texts_to_trade_stats(
            page_html_artifacts.base_item_mod_texts,
            trade_stat_index,
            trade_stat_records,
        )
        if patterns:
            patterns_by_slug[page_slug] = patterns
        if stat_ids:
            stat_ids_by_slug[page_slug] = stat_ids
    return patterns_by_slug, stat_ids_by_slug


async def collect_unique_item_stat_artifacts(
    unique_item_names_by_page: dict[str, list[str]],
    trade_stat_index: dict[str, set[str]],
    trade_stat_records: list[TradeStatRecord],
    workers: int,
) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    semaphore = asyncio.Semaphore(max(1, workers))
    patterns_by_page: dict[str, set[str]] = {}
    stat_ids_by_page: dict[str, set[str]] = {}
    tasks_input = [
        (page_slug, item_name)
        for page_slug, item_names in unique_item_names_by_page.items()
        for item_name in item_names
    ]

    async def task(page_slug: str, item_name: str, client: Any) -> tuple[str, list[str], list[str]]:
        item_url = urljoin(POE2DB_ITEM_ROOT_URL, poe2db_item_slug(item_name))
        try:
            async with semaphore:
                html = await fetch_text(client, item_url)
        except Exception as error:
            print(f"[build_extension_data] failed to fetch unique item page {item_url}: {error}", file=sys.stderr)
            return page_slug, [], []

        item_mod_texts = parse_page_html_artifacts(html).item_mod_texts
        patterns, stat_ids = map_trade_stat_texts_to_trade_stat_ids(
            item_mod_texts,
            trade_stat_index,
            trade_stat_records,
            include_unmatched_patterns=False,
        )
        return page_slug, patterns, stat_ids

    async with build_async_client(max_connections=max(1, workers)) as client:
        results = await asyncio.gather(
            *[task(page_slug, item_name, client) for page_slug, item_name in tasks_input]
        )

    for page_slug, patterns, stat_ids in results:
        patterns_by_page.setdefault(page_slug, set()).update(patterns)
        stat_ids_by_page.setdefault(page_slug, set()).update(stat_ids)

    return (
        {page_slug: sorted(patterns) for page_slug, patterns in patterns_by_page.items()},
        {page_slug: sorted(stat_ids) for page_slug, stat_ids in stat_ids_by_page.items()},
    )


async def fetch_trade_stats(url: str) -> dict[str, Any]:
    async with build_async_client(max_connections=1) as client:
        return json.loads(await fetch_text(client, url))


async def fetch_trade_items(url: str) -> dict[str, Any]:
    async with build_async_client(max_connections=1) as client:
        return json.loads(await fetch_text(client, url))


async def collect_poe2db_stat_source_records(
    page_slugs: tuple[str, ...],
    workers: int,
) -> dict[str, list[Poe2dbStatSourceRecord]]:
    """Fetch source pages in each locale without relying on card position."""

    records_by_locale: dict[str, list[Poe2dbStatSourceRecord]] = {locale: [] for locale in ("us", "cn", "tw")}
    semaphore = asyncio.Semaphore(max(1, workers))

    async with build_async_client(max_connections=max(1, workers)) as client:
        async def fetch_page(locale: str, page_slug: str) -> tuple[str, list[Poe2dbStatSourceRecord]]:
            url = f"https://poe2db.tw/{locale}/{page_slug}"
            try:
                async with semaphore:
                    html = await fetch_text(client, url)
                return locale, parse_poe2db_stat_source_records(html, page_slug)
            except Exception as error:
                print(f"[build_extension_data] failed to fetch localized stat source {url}: {error}", file=sys.stderr)
                return locale, []

        tasks = [
            fetch_page(locale, page_slug)
            for page_slug in page_slugs
            for locale in ("us", "cn", "tw")
        ]
        for locale, records in await asyncio.gather(*tasks):
            records_by_locale[locale].extend(records)

    return records_by_locale


async def collect_localized_item_names(
    item_names: list[str],
    page_urls: list[str],
    workers: int,
    allow_item_page_fallback: bool = True,
    include_passive_skills: bool = False,
) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    locales = ("us", "cn", "tw")
    items_by_locale: dict[str, dict[str, tuple[str, str]]] = {locale: {} for locale in locales}

    async with build_async_client(max_connections=max(1, workers)) as client:
        async def fetch_html(url: str) -> str:
            error: Exception | None = None
            for attempt in range(3):
                try:
                    return await fetch_text(client, url)
                except Exception as caught:
                    error = caught
                    if attempt < 2:
                        await asyncio.sleep(attempt + 1)
            raise error or RuntimeError(f"Unable to fetch {url}")

        async def fetch_page(page_url: str, locale: str) -> tuple[str, dict[str, tuple[str, str]]]:
            page_slug = page_slug_from_url(page_url)
            url = f"https://poe2db.tw/{locale}/{page_slug}"
            try:
                html = await fetch_html(url)
                return locale, parse_poe2db_item_name_slugs(
                    html,
                    include_passive_skills=include_passive_skills,
                )
            except Exception as error:
                print(f"[build_extension_data] failed to fetch localized item category {url}: {error}", file=sys.stderr)
                return locale, {}

        tasks = [
            fetch_page(f"https://poe2db.tw/us/{page_slug}", locale)
            for page_slug in sorted({page_slug_from_url(page_url) for page_url in page_urls})
            for locale in locales
        ]
        for locale, items in await asyncio.gather(*tasks):
            for normalized_name, item in items.items():
                items_by_locale[locale].setdefault(normalized_name, item)

        english_names: dict[str, str] = {}
        simplified_names: dict[str, str] = {}
        traditional_names: dict[str, str] = {}
        localized_by_slug = {
            locale: {slug: name for name, slug in records.values()}
            for locale, records in items_by_locale.items()
        }
        pending: list[tuple[str, str, str]] = []
        for item_name in item_names:
            english_item = items_by_locale["us"].get(normalize_lookup_text(item_name))
            slug = ""
            if english_item and normalize_lookup_text(english_item[0]) == normalize_lookup_text(item_name):
                english_names[item_name] = item_name
                slug = english_item[1]
            elif allow_item_page_fallback:
                slug = poe2db_item_slug(item_name)
            if slug and item_name not in english_names:
                pending.append((item_name, slug, "us"))
            localized_name = localized_by_slug["cn"].get(slug, "")
            if localized_name:
                simplified_names[item_name] = localized_name
            elif slug:
                pending.append((item_name, slug, "cn"))
            localized_name = localized_by_slug["tw"].get(slug, "")
            if localized_name:
                traditional_names[item_name] = localized_name
            elif slug:
                pending.append((item_name, slug, "tw"))

        async def fetch_item(item_name: str, slug: str, locale: str) -> tuple[str, str, str]:
            url = f"https://poe2db.tw/{locale}/{slug}"
            try:
                return item_name, locale, parse_poe2db_item_title(await fetch_html(url))
            except Exception as error:
                print(f"[build_extension_data] failed to verify localized item page {url}: {error}", file=sys.stderr)
                return item_name, locale, ""

        for item_name, locale, localized_name in await asyncio.gather(
            *(fetch_item(item_name, slug, locale) for item_name, slug, locale in pending)
        ):
            if locale == "us" and normalize_lookup_text(localized_name) == normalize_lookup_text(item_name):
                english_names[item_name] = item_name
            elif locale == "cn" and localized_name:
                simplified_names[item_name] = localized_name
            elif locale == "tw" and localized_name:
                traditional_names[item_name] = localized_name

    return english_names, simplified_names, traditional_names


async def collect_trade_page_titles(
    page_slugs: dict[str, str],
    workers: int,
) -> dict[str, dict[str, str]]:
    """Fetch upstream concept pages for stable Trade identifiers."""

    locales = {"us": "en", "cn": "zh_CN", "tw": "zh_TW"}
    titles: dict[str, dict[str, str]] = {
        identifier: {} for identifier in page_slugs
    }

    async with build_async_client(max_connections=max(1, workers)) as client:
        async def fetch_title(
            identifier: str,
            page_slug: str,
            locale: str,
            output_locale: str,
        ) -> tuple[str, str, str]:
            url = f"https://poe2db.tw/{locale}/{page_slug}"
            try:
                return identifier, output_locale, parse_poe2db_item_title(await fetch_text(client, url))
            except Exception as error:
                print(f"[build_extension_data] failed to fetch Trade concept page {url}: {error}", file=sys.stderr)
                return identifier, output_locale, ""

        results = await asyncio.gather(
            *(
                fetch_title(identifier, page_slug, locale, output_locale)
                for identifier, page_slug in page_slugs.items()
                for locale, output_locale in locales.items()
            )
        )

    for identifier, locale, title in results:
        if title:
            titles[identifier][locale] = title
    return titles


async def collect_trade_filter_page_titles(workers: int) -> dict[str, dict[str, str]]:
    return await collect_trade_page_titles(TRADE_FILTER_LOCALIZATION_PAGE_SLUGS, workers)


def load_page_artifacts(split_dir: Path, trade_stat_index: dict[str, set[str]]) -> list[PageArtifacts]:
    index_payload = json.loads((split_dir / "index.json").read_text(encoding="utf-8"))
    artifacts: list[PageArtifacts] = []
    for page in index_payload["pages"]:
        page_payload = json.loads((split_dir / page["file"]).read_text(encoding="utf-8"))
        patterns: set[str] = set()
        stat_ids: set[str] = set()
        for affix in page_payload["affixes"]:
            affix_patterns, affix_stat_ids = map_affix_text_to_trade_stat_ids(
                affix.get("text_html") or affix.get("text", ""),
                trade_stat_index,
            )
            patterns.update(affix_patterns)
            stat_ids.update(affix_stat_ids)
        extra_patterns, extra_stat_ids = map_trade_stat_texts_to_trade_stat_ids(
            EXTRA_PAGE_ALLOWED_TRADE_STAT_TEXTS.get(page["page_slug"], []),
            trade_stat_index,
        )
        patterns.update(extra_patterns)
        stat_ids.update(extra_stat_ids)
        artifacts.append(
            PageArtifacts(
                page_slug=page["page_slug"],
                page_group=page.get("page_group"),
                page_url=page["page_url"],
                baseitem_name=page["baseitem_name"],
                allowed_patterns=sorted(patterns),
                allowed_stat_ids=sorted(stat_ids),
                item_names=[],
            )
        )
    return artifacts


def build_unique_item_names_by_page(
    trade_items_payload: dict[str, Any],
    page_categories: dict[str, Any],
) -> dict[str, list[str]]:
    unique_item_names_by_page: dict[str, list[str]] = {}
    default_page_lookup = build_page_item_name_lookup(page_categories, include_item_names=True)
    map_page_lookup = build_map_page_item_name_lookup(page_categories)

    for group in trade_items_payload.get("result", []):
        group_id = group.get("id")
        logical_id = TRADE_ITEM_GROUP_TO_LOGICAL_CATEGORY.get(group_id)
        if not logical_id:
            continue

        page_lookup = (
            default_page_lookup
            if group_id in TRADE_ITEM_GROUPS_WITH_TRUSTED_PAGE_ITEM_NAMES
            else map_page_lookup
        )
        for entry in group.get("entries", []):
            if not isinstance(entry, dict) or not entry.get("flags", {}).get("unique"):
                continue
            if entry.get("disc") == "legacy":
                continue
            item_name = entry.get("name")
            if not item_name:
                continue

            selection = select_trade_item_entry(entry, logical_id, page_lookup)
            if not selection or selection.get("kind") != "page":
                continue
            unique_item_names_by_page.setdefault(selection["id"], []).append(item_name)

    return {
        page_slug: dedupe_preserve_order(item_names)
        for page_slug, item_names in sorted(unique_item_names_by_page.items())
    }


def build_page_categories(
    artifacts: list[PageArtifacts],
    item_names_by_slug: dict[str, list[str]],
    extra_allowed_patterns_by_slug: dict[str, list[str]] | None = None,
    extra_allowed_stat_ids_by_slug: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    page_categories: dict[str, Any] = {}
    extra_allowed_patterns_by_slug = extra_allowed_patterns_by_slug or {}
    extra_allowed_stat_ids_by_slug = extra_allowed_stat_ids_by_slug or {}
    for artifact in artifacts:
        item_names = dedupe_preserve_order(
            [
                *item_names_by_slug.get(artifact.page_slug, []),
                *EXTRA_PAGE_ITEM_NAMES.get(artifact.page_slug, []),
            ]
        )
        page_categories[artifact.page_slug] = {
            "label": artifact.baseitem_name,
            "pageGroup": artifact.page_group,
            "pageUrl": artifact.page_url,
            "allowedPatterns": sorted(
                {
                    *artifact.allowed_patterns,
                    *extra_allowed_patterns_by_slug.get(artifact.page_slug, []),
                }
            ),
            "allowedStatIds": sorted(
                {
                    *artifact.allowed_stat_ids,
                    *extra_allowed_stat_ids_by_slug.get(artifact.page_slug, []),
                }
            ),
            "itemNames": item_names,
            "aliases": dedupe_preserve_order(
                [
                    artifact.baseitem_name,
                    artifact.page_group or "",
                    humanize_slug(artifact.page_slug),
                ]
            ),
        }
    return page_categories


def build_logical_categories(page_categories: dict[str, Any]) -> dict[str, Any]:
    logical_categories: dict[str, Any] = {}
    for logical_id, spec in LOGICAL_CATEGORY_SPECS.items():
        patterns: set[str] = set()
        stat_ids: set[str] = set()
        item_names: list[str] = []
        page_slugs: list[str] = []
        for page_slug in spec["page_slugs"]:
            page = page_categories.get(page_slug)
            if not page:
                continue
            page_slugs.append(page_slug)
            patterns.update(page["allowedPatterns"])
            stat_ids.update(page["allowedStatIds"])
            item_names.extend(page["itemNames"])
        logical_categories[logical_id] = {
            "label": spec["label"],
            "aliases": dedupe_preserve_order(spec["aliases"]),
            "pageSlugs": page_slugs,
            "allowedPatterns": sorted(patterns),
            "allowedStatIds": sorted(stat_ids),
            "itemNames": dedupe_preserve_order(item_names),
        }
    return logical_categories


def build_item_name_map(
    page_categories: dict[str, Any],
    item_name_to_selection: dict[str, dict[str, str]] | None = None,
) -> dict[str, str]:
    item_name_to_page: dict[str, str] = {}
    authoritative_item_names = set(item_name_to_selection or {})
    for page_slug, page in page_categories.items():
        if page_slug in POE2DB_ITEM_NAME_FALLBACK_EXCLUDED_PAGE_SLUGS:
            continue
        for item_name in page["itemNames"]:
            normalized = normalize_lookup_text(item_name)
            if normalized in authoritative_item_names:
                continue
            item_name_to_page.setdefault(normalized, page_slug)
    return item_name_to_page


def build_item_name_selection_map(
    trade_items_payload: dict[str, Any],
    page_categories: dict[str, Any],
) -> dict[str, dict[str, str]]:
    item_name_to_selection: dict[str, dict[str, str]] = {}
    default_page_lookup = build_page_item_name_lookup(page_categories, include_item_names=True)
    map_page_lookup = build_map_page_item_name_lookup(page_categories)

    for group in trade_items_payload.get("result", []):
        group_id = group.get("id")
        logical_id = TRADE_ITEM_GROUP_TO_LOGICAL_CATEGORY.get(group_id)
        if not logical_id:
            continue

        page_lookup = (
            default_page_lookup
            if group_id in TRADE_ITEM_GROUPS_WITH_TRUSTED_PAGE_ITEM_NAMES
            else map_page_lookup
        )
        for entry in group.get("entries", []):
            if not isinstance(entry, dict):
                continue

            selection = select_trade_item_entry(entry, logical_id, page_lookup)
            if not selection:
                continue
            for item_name in trade_item_lookup_names(entry):
                item_name_to_selection.setdefault(normalize_lookup_text(item_name), selection)

    for item_name, selection in LOCALIZED_ITEM_NAME_SELECTION_OVERRIDES.items():
        item_name_to_selection[normalize_lookup_text(item_name)] = selection

    return item_name_to_selection


def build_favorite_item_display_names(
    trade_items_payload: dict[str, Any],
    page_categories: dict[str, Any],
) -> list[str]:
    names: list[str] = []
    default_page_lookup = build_page_item_name_lookup(page_categories, include_item_names=True)
    map_page_lookup = build_map_page_item_name_lookup(page_categories)
    for group in trade_items_payload.get("result", []):
        group_id = group.get("id")
        logical_id = TRADE_ITEM_GROUP_TO_LOGICAL_CATEGORY.get(group_id)
        if not logical_id:
            continue
        page_lookup = (
            default_page_lookup
            if group_id in TRADE_ITEM_GROUPS_WITH_TRUSTED_PAGE_ITEM_NAMES
            else map_page_lookup
        )
        for entry in group.get("entries", []):
            if not isinstance(entry, dict) or not select_trade_item_entry(entry, logical_id, page_lookup):
                continue
            # Result items store the trade entry's base `type`, not the optional
            # unique-name search aliases in `text`.
            item_name = str(entry.get("type") or "").strip()
            if item_name:
                names.append(item_name)
    return dedupe_preserve_order(names)


def build_page_item_name_lookup(
    page_categories: dict[str, Any],
    include_item_names: bool,
) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for page_slug, page in page_categories.items():
        names = [
            page["label"],
            *page.get("aliases", []),
        ]
        if include_item_names:
            names.extend(page.get("itemNames", []))
        for name in names:
            normalized = normalize_lookup_text(name)
            if normalized:
                lookup.setdefault(normalized, page_slug)
    return lookup


def build_map_page_item_name_lookup(page_categories: dict[str, Any]) -> dict[str, str]:
    lookup = build_page_item_name_lookup(page_categories, include_item_names=False)
    for page_slug, item_names in EXTRA_PAGE_ITEM_NAMES.items():
        if page_slug not in page_categories:
            continue
        for item_name in item_names:
            lookup[normalize_lookup_text(item_name)] = page_slug
    return lookup


def select_trade_item_entry(
    entry: dict[str, Any],
    logical_id: str,
    page_lookup: dict[str, str],
) -> dict[str, str] | None:
    item_type = normalize_lookup_text(entry.get("type") or "")
    page_slug = page_lookup.get(item_type)
    if page_slug:
        return {"kind": "page", "id": page_slug}
    return {"kind": "logical", "id": logical_id}


def trade_item_lookup_names(entry: dict[str, Any]) -> list[str]:
    return dedupe_preserve_order(
        [
            entry.get("type") or "",
            entry.get("text") or "",
        ]
    )


def build_trade_item_display_names(trade_items_payload: dict[str, Any]) -> list[str]:
    return sorted(
        {
            item_name
            for group in trade_items_payload.get("result", [])
            for entry in group.get("entries", [])
            if isinstance(entry, dict)
            for item_name in trade_item_lookup_names(entry)
            if item_name
        }
    )


def build_category_alias_map(
    page_categories: dict[str, Any],
    logical_categories: dict[str, Any],
) -> dict[str, dict[str, str]]:
    alias_map: dict[str, dict[str, str]] = {}
    for category_id, category in logical_categories.items():
        for alias in category["aliases"]:
            alias_map[normalize_lookup_text(alias)] = {"kind": "logical", "id": category_id}
    for page_slug, page in page_categories.items():
        for alias in page["aliases"]:
            normalized = normalize_lookup_text(alias)
            alias_map.setdefault(normalized, {"kind": "page", "id": page_slug})
    return alias_map


def build_selection_options(
    logical_categories: dict[str, Any],
    page_categories: dict[str, Any],
) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    for logical_id, category in sorted(logical_categories.items()):
        options.append({"kind": "logical", "id": logical_id, "label": category["label"]})
    for page_slug, category in sorted(page_categories.items()):
        options.append(
            {
                "kind": "page",
                "id": page_slug,
                "label": f'{category["label"]} [{page_slug}]',
            }
        )
    return options


async def main() -> int:
    parser = argparse.ArgumentParser(description="Build extension data for the PoE2 trade2 enhancer.")
    parser.add_argument(
        "--split-dir",
        default=str(REPO_ROOT / "build/all-affixes-split"),
        help="Directory containing one scraped JSON file per category plus index.json.",
    )
    parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "data/affix-filter-data.json"),
        help="Output file for the extension data bundle.",
    )
    parser.add_argument(
        "--trade-item-localization-out",
        default=str(REPO_ROOT / "data/trade-item-localization.json"),
        help="Output file for native Trade item-search localization.",
    )
    parser.add_argument("--workers", type=int, default=8, help="Concurrent page fetches.")
    parser.add_argument(
        "--trade-stats-url",
        default=TRADE_STATS_URL,
        help="Official trade2 stats API URL used to map PoE2DB stat text to trade stat ids.",
    )
    parser.add_argument(
        "--trade-items-url",
        default=TRADE_ITEMS_URL,
        help="Official trade2 items API URL used to map selected item names to filter categories.",
    )
    parser.add_argument(
        "--zh-cn-trade-stats-url",
        default=TRADE_STATS_ZH_CN_URL,
        help="Official China trade2 stats API URL used only at build time for simplified Chinese display text.",
    )
    parser.add_argument(
        "--zh-tw-trade-stats-url",
        default=TRADE_STATS_ZH_TW_URL,
        help="Official Taiwan trade2 stats API URL used only at build time for traditional Chinese display text.",
    )
    parser.add_argument(
        "--zh-cn-trade-items-url",
        default=TRADE_ITEMS_ZH_CN_URL,
        help="Official China trade2 items API URL used only at build time for safe localized item names.",
    )
    parser.add_argument(
        "--zh-tw-trade-items-url",
        default=TRADE_ITEMS_ZH_TW_URL,
        help="Official Taiwan trade2 items API URL used only at build time for safe localized item names.",
    )
    parser.add_argument(
        "--trade-static-url",
        default=TRADE_STATIC_URL,
        help="Official international trade2 static API URL used for rendered-text localization.",
    )
    parser.add_argument(
        "--zh-cn-trade-static-url",
        default=TRADE_STATIC_ZH_CN_URL,
        help="Official China trade2 static API URL used for rendered-text localization.",
    )
    parser.add_argument(
        "--zh-tw-trade-static-url",
        default=TRADE_STATIC_ZH_TW_URL,
        help="Official Taiwan trade2 static API URL used for rendered-text localization.",
    )
    parser.add_argument(
        "--trade-filters-url",
        default=TRADE_FILTERS_URL,
        help="Official international trade2 filters API URL used for rendered-text localization.",
    )
    parser.add_argument(
        "--zh-cn-trade-filters-url",
        default=TRADE_FILTERS_ZH_CN_URL,
        help="Official China trade2 filters API URL used for rendered-text localization.",
    )
    parser.add_argument(
        "--zh-tw-trade-filters-url",
        default=TRADE_FILTERS_ZH_TW_URL,
        help="Official Taiwan trade2 filters API URL used for rendered-text localization.",
    )
    parser.add_argument(
        "--client-strings-url",
        default=CLIENT_STRINGS_URL,
        help="Official game client English ClientStrings data used as a Trade UI fallback.",
    )
    parser.add_argument(
        "--zh-tw-client-strings-url",
        default=CLIENT_STRINGS_ZH_TW_URL,
        help="Official game client Traditional Chinese ClientStrings data used as a Trade UI fallback.",
    )
    parser.add_argument(
        "--minimum-display-coverage",
        type=float,
        default=0.95,
        help="Minimum localized coverage for favorite-compatible stat IDs.",
    )
    parser.add_argument(
        "--localized-item-workers",
        type=int,
        default=2,
        help="Concurrent PoE2DB category-page requests for build-time item display metadata.",
    )
    parser.add_argument(
        "--localized-item-cache",
        default=str(REPO_ROOT / "build/localized-item-names.json"),
        help="Build cache for verified PoE2DB item names. It is regenerated when absent.",
    )
    parser.add_argument(
        "--refresh-localized-items",
        action="store_true",
        help="Ignore the localized item-name cache and fetch the current PoE2DB category pages.",
    )
    parser.add_argument(
        "--minimum-item-display-coverage",
        type=float,
        default=0.95,
        help="Minimum localized coverage for favorite item names.",
    )
    parser.add_argument(
        "--minimum-trade-localization-coverage",
        type=float,
        default=0.95,
        help="Minimum regional coverage for stable static/filter Trade UI records.",
    )
    args = parser.parse_args()

    split_dir = Path(args.split_dir)
    trade_stats_payload = await fetch_trade_stats(args.trade_stats_url)
    trade_items_payload = await fetch_trade_items(args.trade_items_url)
    (
        simplified_stats_payload,
        traditional_stats_payload,
        simplified_items_payload,
        traditional_items_payload,
        static_payload,
        simplified_static_payload,
        traditional_static_payload,
        filters_payload,
        simplified_filters_payload,
        traditional_filters_payload,
        client_strings_payload,
        traditional_client_strings_payload,
    ) = await asyncio.gather(
        fetch_trade_stats(args.zh_cn_trade_stats_url),
        fetch_trade_stats(args.zh_tw_trade_stats_url),
        fetch_trade_items(args.zh_cn_trade_items_url),
        fetch_trade_items(args.zh_tw_trade_items_url),
        fetch_trade_stats(args.trade_static_url),
        fetch_trade_stats(args.zh_cn_trade_static_url),
        fetch_trade_stats(args.zh_tw_trade_static_url),
        fetch_trade_stats(args.trade_filters_url),
        fetch_trade_stats(args.zh_cn_trade_filters_url),
        fetch_trade_stats(args.zh_tw_trade_filters_url),
        fetch_trade_stats(args.client_strings_url),
        fetch_trade_stats(args.zh_tw_client_strings_url),
    )
    trade_stat_index = build_trade_stat_index(trade_stats_payload)
    trade_stat_records = build_trade_stat_records(trade_stats_payload)
    trade_skill_stat_index = build_trade_skill_stat_index(trade_stats_payload)
    artifacts = load_page_artifacts(split_dir, trade_stat_index)
    page_html_artifacts_by_slug = await collect_page_html_artifacts(
        [artifact.page_url for artifact in artifacts],
        args.workers,
        PAGE_ITEM_NAME_CLASS_FILTERS,
    )
    item_names_by_slug = {
        page_slug: page_html_artifacts.item_names
        for page_slug, page_html_artifacts in page_html_artifacts_by_slug.items()
    }
    base_item_mod_patterns_by_slug, base_item_mod_stat_ids_by_slug = collect_base_item_mod_stat_artifacts(
        page_html_artifacts_by_slug,
        trade_stat_index,
        trade_stat_records,
    )
    granted_skill_patterns_by_slug: dict[str, list[str]] = {}
    granted_skill_stat_ids_by_slug: dict[str, list[str]] = {}
    for page_slug, page_html_artifacts in page_html_artifacts_by_slug.items():
        granted_patterns, granted_stat_ids = map_granted_skill_names_to_trade_stats(
            page_html_artifacts.granted_skill_names,
            trade_skill_stat_index,
        )
        if granted_patterns:
            granted_skill_patterns_by_slug[page_slug] = granted_patterns
        if granted_stat_ids:
            granted_skill_stat_ids_by_slug[page_slug] = granted_stat_ids

    base_page_categories = build_page_categories(
        artifacts,
        item_names_by_slug,
        merge_extra_artifacts(granted_skill_patterns_by_slug, base_item_mod_patterns_by_slug),
        merge_extra_artifacts(granted_skill_stat_ids_by_slug, base_item_mod_stat_ids_by_slug),
    )
    unique_item_patterns_by_slug, unique_item_stat_ids_by_slug = await collect_unique_item_stat_artifacts(
        build_unique_item_names_by_page(trade_items_payload, base_page_categories),
        trade_stat_index,
        trade_stat_records,
        args.workers,
    )
    extra_allowed_patterns_by_slug = merge_extra_artifacts(
        granted_skill_patterns_by_slug,
        base_item_mod_patterns_by_slug,
        unique_item_patterns_by_slug,
    )
    extra_allowed_stat_ids_by_slug = merge_extra_artifacts(
        granted_skill_stat_ids_by_slug,
        base_item_mod_stat_ids_by_slug,
        unique_item_stat_ids_by_slug,
    )

    page_categories = build_page_categories(
        artifacts,
        item_names_by_slug,
        extra_allowed_patterns_by_slug,
        extra_allowed_stat_ids_by_slug,
    )
    logical_categories = build_logical_categories(page_categories)
    item_name_to_selection = build_item_name_selection_map(trade_items_payload, page_categories)
    favorite_item_display_names = build_favorite_item_display_names(trade_items_payload, page_categories)
    favorite_item_display_name_set = set(favorite_item_display_names)
    simplified_numeric_item_names = build_safe_numeric_trade_item_localizations(
        trade_items_payload,
        simplified_items_payload,
        favorite_item_display_name_set,
    )
    traditional_numeric_item_names = build_safe_numeric_trade_item_localizations(
        trade_items_payload,
        traditional_items_payload,
        favorite_item_display_name_set,
    )
    item_name_to_page = build_item_name_map(page_categories, item_name_to_selection)
    category_alias_to_selection = build_category_alias_map(page_categories, logical_categories)
    selection_options = build_selection_options(logical_categories, page_categories)

    trade_stat_patterns, trade_stat_ids = build_trade_stat_universe(trade_stats_payload)
    all_patterns = sorted(
        set(trade_stat_patterns)
        | {
            pattern
            for page in page_categories.values()
            for pattern in page["allowedPatterns"]
        }
    )
    all_stat_ids = sorted(
        set(trade_stat_ids)
        | {
            stat_id
            for page in page_categories.values()
            for stat_id in page["allowedStatIds"]
        }
    )
    trade_stat_ids = set(build_trade_stat_text_map(trade_stats_payload))
    display_metadata = build_display_metadata(
        trade_stats_payload,
        simplified_stats_payload,
        traditional_stats_payload,
        trade_stat_ids,
        args.minimum_display_coverage,
    )
    display_metadata["statGroups"] = build_trade_stat_group_records(
        trade_stats_payload,
        simplified_stats_payload,
        traditional_stats_payload,
    )
    display_metadata["clientStrings"] = build_client_string_localizations(
        client_strings_payload,
        traditional_client_strings_payload,
    )
    missing_stat_names = sorted(
        {
            str(record.get("en") or "").strip()
            for record in display_metadata["stats"].values()
            if record.get("en")
            and record.get("zh_CN") == record.get("en")
            and record.get("zh_TW") == record.get("en")
        }
    )
    (
        verified_keystone_names,
        keystone_simplified_names,
        keystone_traditional_names,
    ) = await collect_localized_item_names(
        missing_stat_names,
        [f"{POE2DB_ITEM_ROOT_URL}{page_slug}" for page_slug in TRADE_STAT_LOCALIZATION_PAGE_SLUGS],
        args.localized_item_workers,
        allow_item_page_fallback=False,
        include_passive_skills=True,
    )
    display_metadata["poe2dbKeystoneStatCount"] = apply_verified_poe2db_stat_localizations(
        display_metadata["stats"],
        verified_keystone_names,
        keystone_simplified_names,
        keystone_traditional_names,
        TRADE_STAT_LOCALIZATION_OVERRIDES,
    )
    modifier_localizations = build_verified_poe2db_stat_mod_localizations(
        display_metadata["stats"],
        await collect_poe2db_stat_source_records(
            TRADE_STAT_LOCALIZATION_MOD_PAGE_SLUGS,
            args.localized_item_workers,
        ),
    )
    display_metadata["poe2dbModifierStatCount"] = apply_verified_poe2db_stat_localizations(
        display_metadata["stats"],
        {english: english for english in modifier_localizations},
        {english: record["zh_CN"] for english, record in modifier_localizations.items()},
        {english: record["zh_TW"] for english, record in modifier_localizations.items()},
    )
    item_cache_path = Path(args.localized_item_cache)
    cached_item_names: dict[str, dict[str, str]] | None = None
    if item_cache_path.exists() and not args.refresh_localized_items:
        try:
            cached_item_names = json.loads(item_cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"[build_extension_data] ignoring unreadable localized item cache {item_cache_path}: {error}", file=sys.stderr)
    if cached_item_names:
        english_item_names = cached_item_names.get("us", {})
        simplified_item_names = cached_item_names.get("cn", {})
        traditional_item_names = cached_item_names.get("tw", {})
    else:
        english_item_names, simplified_item_names, traditional_item_names = await collect_localized_item_names(
            favorite_item_display_names,
            [artifact.page_url for artifact in artifacts],
            args.localized_item_workers,
        )
        item_cache_path.parent.mkdir(parents=True, exist_ok=True)
        item_cache_path.write_text(
            json.dumps(
                {"us": english_item_names, "cn": simplified_item_names, "tw": traditional_item_names},
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    # The requested names originate from the official English item payload, so
    # they remain valid even when PoE2DB has no individual item page for them.
    english_item_names = {name: name for name in favorite_item_display_names}
    for item_name, localized_name in simplified_numeric_item_names.items():
        simplified_item_names.setdefault(item_name, localized_name)
    for item_name, localized_name in traditional_numeric_item_names.items():
        traditional_item_names.setdefault(item_name, localized_name)
    item_display_metadata = build_item_display_metadata(
        favorite_item_display_names,
        english_item_names,
        simplified_item_names,
        traditional_item_names,
        args.minimum_item_display_coverage,
    )
    display_metadata["items"] = item_display_metadata["items"]
    display_metadata["poe2dbItemPrefixCount"] = apply_verified_item_prefix_localizations(
        display_metadata["items"],
        TRADE_ITEM_PREFIX_LOCALIZATIONS,
    )
    trade_item_display_names = build_trade_item_display_names(trade_items_payload)
    (
        supplemental_english_item_names,
        supplemental_simplified_item_names,
        supplemental_traditional_item_names,
    ) = await collect_localized_item_names(
        trade_item_display_names,
        [f"{POE2DB_ITEM_ROOT_URL}{page_slug}" for page_slug in TRADE_ITEM_LOCALIZATION_PAGE_SLUGS],
        args.localized_item_workers,
        allow_item_page_fallback=False,
    )
    supplemental_verified_item_names = sorted(
        set(supplemental_english_item_names)
        & set(supplemental_simplified_item_names)
        & set(supplemental_traditional_item_names)
    )
    supplemental_item_display_metadata = build_item_display_metadata(
        supplemental_verified_item_names,
        supplemental_english_item_names,
        supplemental_simplified_item_names,
        supplemental_traditional_item_names,
    )
    for item_name, record in supplemental_item_display_metadata["items"].items():
        display_metadata["items"].setdefault(item_name, record)
    display_metadata["coverage"] = {
        "stats": display_metadata["coverage"],
        "items": {
            **item_display_metadata["coverage"],
            "supplemental": {
                "matched": len(supplemental_verified_item_names),
                "total": len(trade_item_display_names),
                "ratio": round(
                    len(supplemental_verified_item_names) / len(trade_item_display_names)
                    if trade_item_display_names
                    else 1.0,
                    6,
                ),
            },
        },
    }
    trade_filter_page_titles = await collect_trade_filter_page_titles(args.localized_item_workers)
    trade_filter_page_localizations = build_trade_filter_page_localizations(
        filters_payload,
        trade_filter_page_titles,
    )
    trade_category_page_titles = await collect_trade_page_titles(
        TRADE_CATEGORY_LOCALIZATION_PAGE_SLUGS,
        args.localized_item_workers,
    )
    trade_category_page_localizations = build_trade_category_page_localizations(
        filters_payload,
        trade_category_page_titles,
    )
    supplemental_trade_strings = dict(trade_filter_page_localizations)
    for record in trade_category_page_localizations.values():
        supplemental_trade_strings.setdefault(record["en"], record)
    trade_localization = build_trade_localization_metadata(
        display_metadata,
        static_payload,
        simplified_static_payload,
        traditional_static_payload,
        filters_payload,
        simplified_filters_payload,
        traditional_filters_payload,
        supplemental_strings=supplemental_trade_strings,
        minimum_coverage=args.minimum_trade_localization_coverage,
        supplemental_categories=trade_category_page_localizations,
    )
    display_metadata.pop("clientStrings", None)

    output = {
        "version": 4,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "https://poe2db.tw/us/Modifiers",
        "tradeStatsSource": args.trade_stats_url,
        "displayMetadataSources": {
            "zh_CN": args.zh_cn_trade_stats_url,
            "zh_TW": args.zh_tw_trade_stats_url,
            "poe2dbKeystones": {
                locale: f"https://poe2db.tw/{locale}/Keystone"
                for locale in ("us", "cn", "tw")
            },
            "poe2dbModifierPages": {
                page_slug: {
                    locale: f"https://poe2db.tw/{locale}/{page_slug}"
                    for locale in ("us", "cn", "tw")
                }
                for page_slug in TRADE_STAT_LOCALIZATION_MOD_PAGE_SLUGS
            },
        },
        "displayItemMetadataSources": {
            "zh_CN": args.zh_cn_trade_items_url,
            "zh_TW": args.zh_tw_trade_items_url,
            "poe2db": "https://poe2db.tw/{locale}/Stackable_Currency",
        },
        "tradeLocalizationSources": {
            "clientStrings": {
                "en": args.client_strings_url,
                "zh_TW": args.zh_tw_client_strings_url,
            },
            "static": {
                "en": args.trade_static_url,
                "zh_CN": args.zh_cn_trade_static_url,
                "zh_TW": args.zh_tw_trade_static_url,
            },
            "filters": {
                "en": args.trade_filters_url,
                "zh_CN": args.zh_cn_trade_filters_url,
                "zh_TW": args.zh_tw_trade_filters_url,
            },
            "poe2dbFilterPages": {
                filter_id: {
                    locale: f"https://poe2db.tw/{locale}/{page_slug}"
                    for locale in ("us", "cn", "tw")
                }
                for filter_id, page_slug in TRADE_FILTER_LOCALIZATION_PAGE_SLUGS.items()
            },
            "poe2dbCategoryPages": {
                category_id: {
                    locale: f"https://poe2db.tw/{locale}/{page_slug}"
                    for locale in ("us", "cn", "tw")
                }
                for category_id, page_slug in TRADE_CATEGORY_LOCALIZATION_PAGE_SLUGS.items()
            },
        },
        "tradeItemsSource": args.trade_items_url,
        "pageCategories": page_categories,
        "logicalCategories": logical_categories,
        "itemNameToPage": item_name_to_page,
        "itemNameToSelection": item_name_to_selection,
        "categoryAliasToSelection": category_alias_to_selection,
        "selectionOptions": selection_options,
        "allPatterns": all_patterns,
        "allStatIds": all_stat_ids,
        "displayMetadata": display_metadata,
        "tradeLocalization": trade_localization,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    trade_item_localization_path = Path(args.trade_item_localization_out)
    trade_item_localization_path.parent.mkdir(parents=True, exist_ok=True)
    trade_item_localization_path.write_text(
        json.dumps(build_trade_item_localization_bundle(trade_localization), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
