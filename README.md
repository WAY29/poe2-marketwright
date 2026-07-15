<a id="readme-top"></a>

<div align="center">
  <a href="https://github.com/WAY29/poe2-marketwright">
    <img src="assets/poe2-marketwright-icon.png" alt="PoE2 Marketwright icon" width="96" height="96">
  </a>

  <h1>PoE2 Marketwright</h1>

  <p>A Chromium browser extension for the official Path of Exile 2 Trade site.</p>

  <p>
    <a href="#features"><strong>Explore features</strong></a>
    ·
    <a href="https://github.com/WAY29/poe2-marketwright/releases">Download a release</a>
    ·
    <a href="https://github.com/WAY29/poe2-marketwright/issues">Report an issue</a>
  </p>

  <p>
    <a href="README.md">English</a>
    ·
    <a href="README.zh-CN.md">简体中文</a>
  </p>
</div>

> [!IMPORTANT]
> This project has been developed primarily through AI-assisted vibe coding. Do not use it if that is a concern for you. Features may still contain defects, including affix filtering and PoB copy; please report reproducible problems in [Issues](https://github.com/WAY29/poe2-marketwright/issues).

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about">About the Project</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#data">Data and Localization</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<a id="about"></a>
## About the Project

PoE2 Marketwright adds localization, affix filtering and search, Tier selection, item and search-link favorites, PoB copy, and fixed-price currency conversion to the official [`trade2`](https://www.pathofexile.com/trade2) page. It works within the Trade page and does not replace the official website.

### Built With

- Chrome Extensions Manifest V3
- Official international, China, and Taiwan Trade data endpoints
- [PoE2DB](https://poe2db.tw/us/) modifier and item-category data
- [Poe2Scout](https://poe2scout.com/) reference currency rates

<a id="features"></a>
## Features

### Trade Page Localization and UI Languages

The Trade page can be displayed in Simplified or Traditional Chinese, while extension controls can independently use English, Simplified Chinese, or Traditional Chinese. Item, category, and stat selectors accept English, Simplified Chinese, and Traditional Chinese input, then resolve it to the same native Trade option. The data comes from the China and Taiwan Trade sites and PoE2DB.

<p align="center">
  <img src="assets/localization-trade-page.png" alt="Trade page language setting" width="33%">
  <img src="assets/localization-extension-ui.png" alt="Extension UI language setting" width="62%">
</p>

### Affix Filtering

The extension keeps only modifiers that the selected item type or specific item can have, hiding unrelated suggestions.

For example, searching `Critical Strike Chance` for a bow without filtering shows similarly named modifiers from several item types. Selecting the wrong one returns no results. With filtering enabled, the list narrows to the modifier available to bows.

<p align="center">
  <img src="assets/affix-filter-before.png" alt="Critical strike suggestions without affix filtering" width="57%">
  <img src="assets/affix-filter-after.png" alt="Critical strike suggestions with affix filtering" width="40%">
</p>

### Enhanced Affix Search

Use ASCII spaces to separate terms in item and stat selectors. Every term must be present, so a query such as `gold ring` can match a longer option containing both terms, with each matched term highlighted. The official Trade site has a similar search behavior behind a `~` prefix; this extension enables multi-term search by default without changing single-term searches or manually entered `~` queries.

<p align="center">
  <img src="assets/affix-search-keywords.png" alt="Space-separated affix search" width="92%">
</p>

### Affix Tier Selection

Stats with Tier support show a `T` button on the left for selecting a Tier directly.

- When an item type or specific item is selected, the menu only shows that item's Tiers.
- Without an item type or specific item, compatible item types are labelled in the menu so you can select among possible sources.
- `Minimum` is the default mode: it sets only `MIN` and preserves the existing `MAX`. `Exact` sets both `MIN` and `MAX` to the selected Tier's average range.

<p align="center">
  <img src="assets/tier-selected-item.png" alt="Tier list for a selected item type" width="36%">
  <img src="assets/tier-multiple-categories.png" alt="Tier list with multiple item types" width="31%">
  <img src="assets/tier-category-labels.png" alt="Tier list labelled by item type" width="31%">
</p>

Tier mappings are generated from verified PoE2DB modifier ranges and matched by stable Trade stat IDs; ambiguous stats do not show the selector. For modifiers with overlapping ranges, such as added damage, selecting T1 may still return T2 because the filter uses average values rather than full modifier ranges.

### Item Favorites

Save an item for later when you cannot buy it yet. With this feature enabled, a favorite button appears below the item icon in each result row. The favorites view lets you return to saved items, create folders, organize entries, and preview their filters and modifiers.

<p align="center">
  <img src="assets/favorites-item-button.png" alt="Item favorite button in a result row" width="36%">
  <img src="assets/favorites-item-library.png" alt="Item favorites management view" width="55%">
</p>

### Search-Link Favorites

Search-link favorites save the current search URL and its complete search conditions, making it quick to return to a category of items. The favorites view supports folders, organization, and previews of the link's filters and modifiers.

<p align="center">
  <img src="assets/favorites-search-links.png" alt="Search-link favorites management view" width="44%">
</p>

### PoB Copy Button

To check whether an item improves your character, click `Copy to PoB` below the result-row item icon. The extension copies item text to the clipboard for import through Path of Building's Create Custom flow.

<p align="center">
  <img src="assets/pob-copy-button.png" alt="Copy to PoB button in a result row" width="35%">
  <img src="assets/pob-create-custom.png" alt="Path of Building Create Custom import" width="56%">
</p>

### Price Conversion

When a search uses an "equivalent to Exalted Orb" buyout, results can include Chaos, Exalted, and Divine Orb prices. Fixed `~price` and `~b/o` listings show `E`, `C`, and `D` conversion controls for faster comparison.

<p align="center">
  <img src="assets/price-conversion.png" alt="E C D price conversion in Trade results" width="92%">
</p>

Rates come from Poe2Scout for the active Trade league. They can be delayed and should be used only as a decision aid.

<a id="getting-started"></a>
## Getting Started

### Prerequisites

- A Chrome or Chromium browser that can load extensions.

### Install a Release

The recommended approach is to download a built package from [GitHub Releases](https://github.com/WAY29/poe2-marketwright/releases).

1. Download the latest zip from [GitHub Releases](https://github.com/WAY29/poe2-marketwright/releases).
2. Extract the zip to a local directory.
3. Open `chrome://extensions`.
4. Enable `Developer mode` in the upper-right corner.
5. Select `Load unpacked`.
6. Select the extracted directory.

### Load from Source

1. Open `chrome://extensions`.
2. Enable `Developer mode` in the upper-right corner.
3. Select `Load unpacked`.
4. Select this repository's root directory.

<a id="data"></a>
## Data and Localization

### Refresh Extension Data

From the repository root, run:

```bash
uv run --project scripts python scripts/poe2_scraper.py scrape --scope all --split-dir build/all-affixes-split --out build/all-affixes-all.json --pretty
uv run --project scripts python scripts/build_extension_data.py --split-dir build/all-affixes-split --out data/affix-filter-data.json
```

`data/affix-filter-data.json` is generated output. Refresh it with these commands rather than editing it by hand.

### Data Sources

- [PoE2DB Modifiers](https://poe2db.tw/us/Modifiers) and category pages such as [Amulets](https://poe2db.tw/us/Amulets#ModifiersCalc).
- Official international Trade API endpoints for [`items`](https://www.pathofexile.com/api/trade2/data/items), [`stats`](https://www.pathofexile.com/api/trade2/data/stats), [`static`](https://www.pathofexile.com/api/trade2/data/static), and [`filters`](https://www.pathofexile.com/api/trade2/data/filters).
- The corresponding China and Taiwan endpoints at `https://poe.game.qq.com/api/trade2/data/*` and `https://pathofexile.tw/api/trade2/data/*`. Build-time processing aligns all three data sources by stable ID.
- Public PoE2DB item-category pages, including [Stackable Currency](https://poe2db.tw/us/Stackable_Currency), verify Trade names for currency, gems, relics, and other items by slug.
- [Poe2Scout Reference Currencies](https://api.poe2scout.com/poe2/Leagues/{league}/ReferenceCurrencies) for E/C/D conversion.

### Localization Coverage

The generated Trade localization bundle currently covers:

- Item display names: Simplified Chinese `2198/2200` (99.91%), Traditional Chinese `2200/2200` (100%).
- Trade stat templates: Simplified Chinese `8057/8141` (98.97%), Traditional Chinese `8059/8141` (98.99%).

These counts cover item names and stat templates with stable totals. Native Trade UI text is provided dynamically by regional Trade APIs, so it has no fixed total.

<a id="license"></a>
## License

Distributed under the [MIT License](LICENSE).

<a id="acknowledgments"></a>
## Acknowledgments

- [PoE2DB](https://poe2db.tw/us/) provides modifier and item-category data for affix filtering.
- [Poe2Scout](https://poe2scout.com/) provides reference currency rates for price conversion.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
