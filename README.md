# PoE2 Marketwright

PoE2 Marketwright is a broader Path of Exile 2 market extension workspace. The current feature set enhances `https://www.pathofexile.com/trade2` by hiding affix suggestions that do not belong to the currently selected category or item, and the structure is intended to absorb more market-page features later.

## What it does

- Adds an on-page toggle panel.
- Auto-detects the current category or item name from the trade2 filters.
- Filters visible affix suggestion lists using the scraped PoE2DB data.
- Allows manual override when auto-detection is not enough.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this repository root directory.

## Refresh the data bundle

From the repository root:

```bash
scripts/.venv/bin/python scripts/poe2_scraper.py scrape --scope all --split-dir build/all-affixes-split --out build/all-affixes-all.json --pretty
scripts/.venv/bin/python scripts/build_extension_data.py --split-dir build/all-affixes-split --out data/affix-filter-data.json
```

## Data sources

- `https://poe2db.tw/us/Modifiers`
- category pages such as `https://poe2db.tw/us/Amulets#ModifiersCalc`
- official item/stat naming from `https://www.pathofexile.com/api/trade2/data/items` and `https://www.pathofexile.com/api/trade2/data/stats` is compatible with the generated canonical patterns
