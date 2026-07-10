# PoE2 Marketwright

[中文说明 / Chinese Documentation](./README.zh-CN.md)

PoE2 Marketwright is a broader Path of Exile 2 market extension workspace. The current feature set enhances `https://www.pathofexile.com/trade2` by hiding affix suggestions that do not belong to the currently selected category or item, and the structure is intended to absorb more market-page features later.

## What it does

- Adds an on-page toggle panel for stat filtering, PoB copy, and C/D price conversion.
- Separates stat filtering and PoB Copy Button controls with independent toggles.
- Auto-detects the current category or item name from the trade2 filters.
- Filters visible affix suggestion lists using the scraped PoE2DB data.
- Allows manual override when auto-detection is not enough.
- Adds a PoB Create Custom copy button to trade result rows.
- Adds `E`, `C`, and `D` conversion controls for fixed Exalted, Chaos, and Divine Orb prices. Rates are fetched from Poe2Scout for the active trade league; the panel refresh button forces a live update.

## Install

The recommended way to install the extension is to download the prebuilt package from [GitHub Releases](https://github.com/WAY29/poe2-marketwright/releases).

1. Download the latest release zip from [GitHub Releases](https://github.com/WAY29/poe2-marketwright/releases).
2. Extract the zip to a local folder.
3. Open `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the extracted folder.

## Load from source

For local development:

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this repository root directory.

## Refresh the data bundle

From the repository root:

```bash
uv run --project scripts python scripts/poe2_scraper.py scrape --scope all --split-dir build/all-affixes-split --out build/all-affixes-all.json --pretty
uv run --project scripts python scripts/build_extension_data.py --split-dir build/all-affixes-split --out data/affix-filter-data.json
```

## Data sources

- `https://poe2db.tw/us/Modifiers`
- category pages such as `https://poe2db.tw/us/Amulets#ModifiersCalc`
- official item/stat naming from `https://www.pathofexile.com/api/trade2/data/items` and `https://www.pathofexile.com/api/trade2/data/stats` is compatible with the generated canonical patterns
- C/D conversion rates come from `https://api.poe2scout.com/poe2/Leagues/{league}/ReferenceCurrencies`
