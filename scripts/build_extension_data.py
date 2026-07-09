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
GRANTED_SKILL_RE = re.compile(r"\bGrants\s+Skill:\s*(?:Level\s+(?:#|\d+)\s*)?(.+?)\s*$", re.IGNORECASE)
TRADE_STATS_URL = "https://www.pathofexile.com/api/trade2/data/stats"
TRADE_ITEMS_URL = "https://www.pathofexile.com/api/trade2/data/items"
POE2DB_ITEM_ROOT_URL = "https://poe2db.tw/us/"
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
    item_mod_texts: list[str]


@dataclass(frozen=True)
class TradeStatRecord:
    key: str
    pattern: str
    stat_id: str


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

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        class_tokens = (attrs_dict.get("class", "") or "").split()
        if self.capture_item_mod_depth > 0 and tag not in HTML_VOID_TAGS:
            self.capture_item_mod_depth += 1
        if tag == "div" and {"implicitMod", "explicitMod"}.intersection(class_tokens):
            self.capture_item_mod_depth = 1
            self.current_item_mod_text = []

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
    args = parser.parse_args()

    split_dir = Path(args.split_dir)
    trade_stats_payload = await fetch_trade_stats(args.trade_stats_url)
    trade_items_payload = await fetch_trade_items(args.trade_items_url)
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
        granted_skill_patterns_by_slug,
        granted_skill_stat_ids_by_slug,
    )
    unique_item_patterns_by_slug, unique_item_stat_ids_by_slug = await collect_unique_item_stat_artifacts(
        build_unique_item_names_by_page(trade_items_payload, base_page_categories),
        trade_stat_index,
        trade_stat_records,
        args.workers,
    )
    extra_allowed_patterns_by_slug = merge_extra_artifacts(
        granted_skill_patterns_by_slug,
        unique_item_patterns_by_slug,
    )
    extra_allowed_stat_ids_by_slug = merge_extra_artifacts(
        granted_skill_stat_ids_by_slug,
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
    item_name_to_page = build_item_name_map(page_categories, item_name_to_selection)
    category_alias_to_selection = build_category_alias_map(page_categories, logical_categories)
    selection_options = build_selection_options(logical_categories, page_categories)

    all_patterns = sorted(
        {
            pattern
            for page in page_categories.values()
            for pattern in page["allowedPatterns"]
        }
    )
    all_stat_ids = sorted(
        {
            stat_id
            for page in page_categories.values()
            for stat_id in page["allowedStatIds"]
        }
    )

    output = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "https://poe2db.tw/us/Modifiers",
        "tradeStatsSource": args.trade_stats_url,
        "tradeItemsSource": args.trade_items_url,
        "pageCategories": page_categories,
        "logicalCategories": logical_categories,
        "itemNameToPage": item_name_to_page,
        "itemNameToSelection": item_name_to_selection,
        "categoryAliasToSelection": category_alias_to_selection,
        "selectionOptions": selection_options,
        "allPatterns": all_patterns,
        "allStatIds": all_stat_ids,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
