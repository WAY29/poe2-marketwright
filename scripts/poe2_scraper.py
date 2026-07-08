#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

try:
    import aiohttp
except ModuleNotFoundError:  # pragma: no cover
    aiohttp = None


DEFAULT_ROOT_URL = "https://poe2db.tw/us/Modifiers"
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; poe2-data-scraper/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
}
HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
MODSVIEW_MARKER = "new ModsView("
PAGE_META_KEYS = {"baseitem", "config", "gen", "opt"}
EXTRA_MODSVIEW_PAGE_SLUGS = {
    "Inscribed_Ultimatum",
    "Relics",
    "Strongbox",
    "Waystones_low_tier",
    "Waystones_mid_tier",
    "Waystones_top_tier",
}
EQUIPMENT_PAGE_SLUGS = {
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
    "Amulets",
    "Rings",
    "Belts",
    "Gloves_str",
    "Gloves_dex",
    "Gloves_int",
    "Gloves_str_dex",
    "Gloves_str_int",
    "Gloves_dex_int",
    "Boots_str",
    "Boots_dex",
    "Boots_int",
    "Boots_str_dex",
    "Boots_str_int",
    "Boots_dex_int",
    "Body_Armours_str",
    "Body_Armours_dex",
    "Body_Armours_int",
    "Body_Armours_str_dex",
    "Body_Armours_str_int",
    "Body_Armours_dex_int",
    "Body_Armours_str_dex_int",
    "Helmets_str",
    "Helmets_dex",
    "Helmets_int",
    "Helmets_str_dex",
    "Helmets_str_int",
    "Helmets_dex_int",
    "Quivers",
    "Shields_str",
    "Shields_str_dex",
    "Shields_str_int",
    "Bucklers",
    "Foci",
}


class ModifierLinksParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href and ("#ModifiersCalc" in href or page_slug_from_url(href) in EXTRA_MODSVIEW_PAGE_SLUGS):
            self.links.append(href)


@dataclass
class PageResult:
    order: int
    summary: dict[str, Any]
    affixes: list[dict[str, Any]]


def require_aiohttp() -> Any:
    if aiohttp is None:  # pragma: no cover
        raise RuntimeError(
            "aiohttp is not installed. Run `uv sync` to install dependencies first."
        )
    return aiohttp


def build_async_client(max_connections: int) -> Any:
    aiohttp_module = require_aiohttp()
    timeout = aiohttp_module.ClientTimeout(total=30.0, connect=10.0)
    connector = aiohttp_module.TCPConnector(
        limit=max_connections,
        limit_per_host=max_connections,
    )
    return aiohttp_module.ClientSession(
        headers=DEFAULT_HEADERS,
        timeout=timeout,
        connector=connector,
        raise_for_status=True,
        trust_env=True,
    )


async def fetch_text(client: Any, url: str) -> str:
    async with client.get(url, allow_redirects=True) as response:
        return await response.text()


def discover_modifier_links(html: str, base_url: str = DEFAULT_ROOT_URL) -> list[str]:
    parser = ModifierLinksParser()
    parser.feed(html)

    seen: set[str] = set()
    links: list[str] = []
    for href in parser.links:
        absolute = urljoin(base_url, href)
        if absolute not in seen:
            seen.add(absolute)
            links.append(absolute)
    return links


def filter_modifier_links(links: list[str], scope: str = "all") -> list[str]:
    if scope == "all":
        return links
    if scope != "equipment":
        raise ValueError(f"Unsupported scope: {scope}")
    return [link for link in links if page_slug_from_url(link) in EQUIPMENT_PAGE_SLUGS]


def extract_modsview_payload(html: str) -> dict[str, Any]:
    marker_index = html.find(MODSVIEW_MARKER)
    if marker_index < 0:
        raise ValueError("Unable to find ModsView payload in page")

    brace_start = html.find("{", marker_index)
    if brace_start < 0:
        raise ValueError("Unable to locate ModsView JSON start")

    payload_text = _extract_balanced_json(html, brace_start)
    return json.loads(payload_text)


def _extract_balanced_json(text: str, start_index: int) -> str:
    depth = 0
    in_string = False
    is_escaped = False

    for index in range(start_index, len(text)):
        char = text[index]

        if in_string:
            if is_escaped:
                is_escaped = False
            elif char == "\\":
                is_escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start_index : index + 1]

    raise ValueError("Unterminated ModsView JSON payload")


def flatten_affixes(page_url: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    affixes: list[dict[str, Any]] = []
    baseitem = payload.get("baseitem", {})
    config = payload.get("config", {})
    gen = payload.get("gen", {})
    opt = payload.get("opt", {})
    page_slug = page_slug_from_url(page_url)
    baseitem_name = strip_html(baseitem.get("link_name") or page_slug)

    for group_name, entries in payload.items():
        if group_name in PAGE_META_KEYS or not isinstance(entries, list):
            continue

        group_title = strip_html(config.get(group_name, {}).get("title", group_name))
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            generation_type_id = str(entry.get("ModGenerationTypeID", "0"))
            affixes.append(
                {
                    "page_slug": page_slug,
                    "page_group": baseitem.get("href"),
                    "page_url": page_url,
                    "baseitem_name": baseitem_name,
                    "item_class_code": opt.get("ItemClassesCode"),
                    "item_class_id": opt.get("ItemClassesID"),
                    "affix_group": group_name,
                    "affix_group_title": group_title,
                    "generation_type_id": generation_type_id,
                    "generation_type": classify_generation_type(generation_type_id, gen),
                    "name": entry.get("Name"),
                    "code": entry.get("Code"),
                    "text": strip_html(entry.get("str")),
                    "text_html": entry.get("str"),
                    "required_level": parse_int(entry.get("Level") or entry.get("reqlvl")),
                    "drop_chance": parse_int(entry.get("DropChance")),
                    "families": list(entry.get("ModFamilyList") or []),
                    "spawn_on": list(entry.get("spawn_no") or []),
                    "tags": normalize_html_list(entry.get("mod_no")),
                    "fossil_tags": list(entry.get("fossil_no") or []),
                    "adds_tags": list(entry.get("adds_no") or []),
                    "hover": entry.get("hover"),
                    "source_type": entry.get("type"),
                }
            )

    return affixes


def classify_generation_type(generation_type_id: str, gen: dict[str, str]) -> str:
    if generation_type_id == "1":
        return strip_html(gen.get("1", "prefix")).lower() or "prefix"
    if generation_type_id == "2":
        return strip_html(gen.get("2", "suffix")).lower() or "suffix"
    return "misc"


def normalize_html_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    normalized: list[str] = []
    for value in values:
        text = strip_html(value)
        if text:
            normalized.append(text)
    return normalized


def strip_html(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = text.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ")
    text = HTML_TAG_RE.sub("", text)
    text = unescape(text)
    text = text.replace("\xa0", " ")
    return WHITESPACE_RE.sub(" ", text).strip()


def parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def page_slug_from_url(url: str) -> str:
    path = urlparse(url).path.rstrip("/")
    if not path:
        return "unknown"
    return path.split("/")[-1]


def build_page_summary(page_url: str, payload: dict[str, Any], affixes: list[dict[str, Any]]) -> dict[str, Any]:
    baseitem = payload.get("baseitem", {})
    opt = payload.get("opt", {})
    group_counts = {
        key: len(value)
        for key, value in payload.items()
        if key not in PAGE_META_KEYS and isinstance(value, list)
    }
    return {
        "page_slug": page_slug_from_url(page_url),
        "page_group": baseitem.get("href"),
        "page_url": page_url,
        "baseitem_name": strip_html(baseitem.get("link_name") or baseitem.get("href")),
        "item_class_code": opt.get("ItemClassesCode"),
        "item_class_id": opt.get("ItemClassesID"),
        "affix_count": len(affixes),
        "group_counts": group_counts,
    }


async def fetch_and_parse_page(client: Any, url: str, semaphore: asyncio.Semaphore) -> dict[str, Any]:
    async with semaphore:
        html = await fetch_text(client, url)
    return extract_modsview_payload(html)


def write_json(path: str | None, payload: Any, pretty: bool = False) -> None:
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        indent=2 if pretty else None,
        separators=None if pretty else (",", ":"),
    )

    if path in (None, "-"):
        print(serialized)
        return

    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(serialized + ("\n" if pretty else ""), encoding="utf-8")


def dump_raw_payload(raw_dir: str, page_url: str, payload: dict[str, Any]) -> None:
    directory = Path(raw_dir)
    directory.mkdir(parents=True, exist_ok=True)
    slug = page_slug_from_url(page_url)
    path = directory / f"{slug}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_split_pages(
    split_dir: str,
    metadata: dict[str, Any],
    pages: list[dict[str, Any]],
    affixes: list[dict[str, Any]],
) -> None:
    directory = Path(split_dir)
    directory.mkdir(parents=True, exist_ok=True)

    affixes_by_slug: dict[str, list[dict[str, Any]]] = {}
    for affix in affixes:
        affixes_by_slug.setdefault(affix["page_slug"], []).append(affix)

    indexed_pages: list[dict[str, Any]] = []
    for page in pages:
        slug = page["page_slug"]
        filename = f"{slug}.json"
        indexed_pages.append({**page, "file": filename})
        page_payload = {
            "source": metadata["source"],
            "fetched_at": metadata["fetched_at"],
            "scope": metadata["scope"],
            "page": page,
            "affixes": affixes_by_slug.get(slug, []),
        }
        (directory / filename).write_text(
            json.dumps(page_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    index_payload = {
        **metadata,
        "scraped_page_count": len(pages),
        "affix_count": len(affixes),
        "pages": indexed_pages,
    }
    (directory / "index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


async def command_discover(args: argparse.Namespace) -> int:
    async with build_async_client(max_connections=1) as client:
        html = await fetch_text(client, args.url)
    links = discover_modifier_links(html, args.url)
    write_json(args.out, links, pretty=args.pretty)
    return 0


async def scrape_page(
    order: int,
    url: str,
    client: Any,
    semaphore: asyncio.Semaphore,
    raw_dir: str | None,
) -> PageResult:
    payload = await fetch_and_parse_page(client, url, semaphore)
    affixes = flatten_affixes(url, payload)
    summary = build_page_summary(url, payload, affixes)
    if raw_dir:
        dump_raw_payload(raw_dir, url, payload)
    return PageResult(order=order, summary=summary, affixes=affixes)


async def command_scrape(args: argparse.Namespace) -> int:
    async with build_async_client(max_connections=max(1, args.workers)) as client:
        root_html = await fetch_text(client, args.url)
        discovered_links = discover_modifier_links(root_html, args.url)
        links = filter_modifier_links(discovered_links, scope=args.scope)
        if args.limit:
            links = links[: args.limit]

        semaphore = asyncio.Semaphore(max(1, args.workers))
        tasks = [
            scrape_page(index, url, client, semaphore, args.raw_dir)
            for index, url in enumerate(links)
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    ordered_results: list[PageResult] = []
    errors: list[dict[str, Any]] = []
    for index, result in enumerate(raw_results):
        if isinstance(result, Exception):  # pragma: no cover
            errors.append({"page_url": links[index], "error": str(result)})
            continue
        ordered_results.append(result)

    ordered_results.sort(key=lambda result: result.order)
    pages = [result.summary for result in ordered_results]
    affixes = [affix for result in ordered_results for affix in result.affixes]

    payload = {
        "source": args.url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "scope": args.scope,
        "discovered_page_count": len(discovered_links),
        "selected_page_count": len(links),
        "scraped_page_count": len(pages),
        "affix_count": len(affixes),
        "pages": pages,
        "affixes": affixes,
        "errors": errors,
    }
    if args.split_dir:
        write_split_pages(
            split_dir=args.split_dir,
            metadata={
                "source": payload["source"],
                "fetched_at": payload["fetched_at"],
                "scope": payload["scope"],
                "discovered_page_count": payload["discovered_page_count"],
                "selected_page_count": payload["selected_page_count"],
                "errors": payload["errors"],
            },
            pages=pages,
            affixes=affixes,
        )
    write_json(args.out, payload, pretty=args.pretty)
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape Path of Exile 2 affixes from PoE2DB ModsView pages."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover", help="Discover #ModifiersCalc pages.")
    discover_parser.add_argument("--url", default=DEFAULT_ROOT_URL, help="Modifiers index page URL.")
    discover_parser.add_argument("--out", default="-", help="Write discovered links to this JSON file.")
    discover_parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    discover_parser.set_defaults(func=command_discover)

    scrape_parser = subparsers.add_parser("scrape", help="Scrape discovered affix pages.")
    scrape_parser.add_argument("--url", default=DEFAULT_ROOT_URL, help="Modifiers index page URL.")
    scrape_parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "build/poe2-affixes.json"),
        help="Write scraped affixes to this JSON file.",
    )
    scrape_parser.add_argument(
        "--raw-dir",
        help="Optional directory for dumping the raw ModsView payload of each page.",
    )
    scrape_parser.add_argument("--workers", type=int, default=8, help="Concurrent page fetches.")
    scrape_parser.add_argument("--limit", type=int, help="Only scrape the first N discovered pages.")
    scrape_parser.add_argument(
        "--scope",
        choices=["all", "equipment"],
        default="all",
        help="Restrict scraping scope before fetching page details.",
    )
    scrape_parser.add_argument(
        "--split-dir",
        help="Optional directory to write one JSON file per scraped category plus an index.json.",
    )
    scrape_parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    scrape_parser.set_defaults(func=command_scrape)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return asyncio.run(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
