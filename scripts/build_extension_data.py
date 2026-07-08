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

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from poe2_scraper import build_async_client, fetch_text, page_slug_from_url, strip_html


NUMBER_RE = re.compile(r"([-+]?\d+(?:\.\d+)?)")
WHITESPACE_RE = re.compile(r"\s+")
HTML_BREAK_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
TRADE_STATS_URL = "https://www.pathofexile.com/api/trade2/data/stats"
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


@dataclass
class PageArtifacts:
    page_slug: str
    page_group: str | None
    page_url: str
    baseitem_name: str
    allowed_patterns: list[str]
    allowed_stat_ids: list[str]
    item_names: list[str]


class WhiteItemAnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.capture_anchor = False
        self.current_text: list[str] = []
        self.item_names: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag != "a":
            return
        class_name = attrs_dict.get("class", "") or ""
        if "whiteitem" in class_name:
            self.capture_anchor = True
            self.current_text = []

    def handle_endtag(self, tag: str) -> None:
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


def humanize_slug(slug: str) -> str:
    return slug.replace("_", " ")


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


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            output.append(value)
    return output


async def fetch_page_item_names(page_url: str) -> list[str]:
    async with build_async_client(max_connections=1) as client:
        html = await fetch_text(client, page_url)
    parser = WhiteItemAnchorParser()
    parser.feed(html)
    return dedupe_preserve_order(parser.item_names)


async def collect_item_names(page_urls: list[str], workers: int) -> dict[str, list[str]]:
    semaphore = asyncio.Semaphore(max(1, workers))

    async def task(page_url: str, client: Any) -> tuple[str, list[str]]:
        async with semaphore:
            html = await fetch_text(client, page_url)
        parser = WhiteItemAnchorParser()
        parser.feed(html)
        return page_slug_from_url(page_url), dedupe_preserve_order(parser.item_names)

    async with build_async_client(max_connections=max(1, workers)) as client:
        tasks = [task(page_url, client) for page_url in page_urls]
        results = await asyncio.gather(*tasks)
    return dict(results)


async def fetch_trade_stats(url: str) -> dict[str, Any]:
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


def build_page_categories(artifacts: list[PageArtifacts], item_names_by_slug: dict[str, list[str]]) -> dict[str, Any]:
    page_categories: dict[str, Any] = {}
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
            "allowedPatterns": artifact.allowed_patterns,
            "allowedStatIds": artifact.allowed_stat_ids,
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


def build_item_name_map(page_categories: dict[str, Any]) -> dict[str, str]:
    item_name_to_page: dict[str, str] = {}
    for page_slug, page in page_categories.items():
        for item_name in page["itemNames"]:
            normalized = normalize_lookup_text(item_name)
            item_name_to_page.setdefault(normalized, page_slug)
    return item_name_to_page


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
    args = parser.parse_args()

    split_dir = Path(args.split_dir)
    trade_stats_payload = await fetch_trade_stats(args.trade_stats_url)
    trade_stat_index = build_trade_stat_index(trade_stats_payload)
    artifacts = load_page_artifacts(split_dir, trade_stat_index)
    item_names_by_slug = await collect_item_names([artifact.page_url for artifact in artifacts], args.workers)

    page_categories = build_page_categories(artifacts, item_names_by_slug)
    logical_categories = build_logical_categories(page_categories)
    item_name_to_page = build_item_name_map(page_categories)
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
        "pageCategories": page_categories,
        "logicalCategories": logical_categories,
        "itemNameToPage": item_name_to_page,
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
