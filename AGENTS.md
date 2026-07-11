# PoE2 Marketwright

## Purpose

PoE2 Marketwright is a Manifest V3 browser extension for the official Path of Exile 2 trade site. It filters affix suggestions by the selected item or category, adds Path of Building copy controls to result rows, and converts fixed Exalted, Chaos, and Divine Orb prices.

## Important URLs

- Official trade page: `https://www.pathofexile.com/trade2`
- Official trade search URL shape: `https://www.pathofexile.com/trade2/search/poe2/{league}/{queryId}`
- Official trade item data: `https://www.pathofexile.com/api/trade2/data/items`
- Official trade stat data: `https://www.pathofexile.com/api/trade2/data/stats`
- PoE2DB modifier index: `https://poe2db.tw/us/Modifiers`
- PoE2DB category example: `https://poe2db.tw/us/Amulets#ModifiersCalc`
- Poe2Scout reference currencies: `https://api.poe2scout.com/poe2/Leagues/{league}/ReferenceCurrencies`
- Releases: `https://github.com/WAY29/poe2-marketwright/releases`

## Runtime Architecture

- `manifest.json` defines the extension entry points, permissions, content script order, and web-accessible resources. Update it whenever a page-injected asset needs to be loaded from the trade DOM.
- `content.js` owns extension-world UI, state persistence, localization, data loading, and page-bridge injection.
- `page-bridge.js` runs in page context. It observes native trade requests and forwards result data through `window.postMessage`; keep this file isolated from Chrome extension APIs.
- `background.js` is the service worker. It performs privileged official-English fetches and Poe2Scout currency fetches, caches rates, and returns diagnostics on errors.
- `currency-conversion.js` owns price parsing, result-row controls, local currency icons, and conversion rendering.
- `pob-copy.js` owns PoB item-text construction and the result-row copy control.
- `content.css` contains all injected UI styling. Keep class names namespaced with `poe2-trade2-affix-filter` or `poe2-marketwright`.
- `_locales/en`, `_locales/zh_CN`, and `_locales/zh_TW` must stay in sync when user-visible copy changes.

## Data Pipeline

- `scripts/poe2_scraper.py` scrapes PoE2DB modifier pages.
- `scripts/build_extension_data.py` merges scraped data with official trade item and stat naming into `data/affix-filter-data.json`.
- Treat `data/affix-filter-data.json` as generated output. Regenerate it rather than hand-editing it.

Refresh the data bundle from the repository root:

```bash
uv run --project scripts python scripts/poe2_scraper.py scrape --scope all --split-dir build/all-affixes-split --out build/all-affixes-all.json --pretty
uv run --project scripts python scripts/build_extension_data.py --split-dir build/all-affixes-split --out data/affix-filter-data.json
```

## Root-Cause Resolution

- Do not hard-code handling for one failing item, error text, locale, URL, or observed data value merely to make the current case pass. Treat it as evidence of a missing data contract, unstable identity, incomplete model, or broken producer-consumer boundary.
- Before implementing a fix, identify the failure's source, the invariant that should hold, and the full set of inputs governed by that invariant. Prefer stable IDs, structured fields, and verified relationships over list position, incidental text, or one-off string tables.
- Implement the narrowest general rule that follows from the verified invariant. If a safe general mapping is unavailable, retain an explicit fallback and report the limitation rather than guessing or silently mislabeling data.
- Add tests for the reported case, the general rule, and its ambiguity or failure boundary. A special-case exception is acceptable only when it represents a documented domain rule and is modeled as such, not as an unverified workaround.

## Price Conversion Rules

- Read the active league from the current official trade page URL, not from an API response or a Poe2Scout league lookup.
- In `/trade2/search/poe2/{league}/{queryId}`, `poe2` is the realm segment and must not be used as the league.
- Request Poe2Scout reference rates directly with the decoded `{league}`. Keep the league and search URL in error diagnostics.
- Support only fixed `~price` and `~b/o` Exalted, Chaos, and Divine Orb listings.
- Show the other two target currencies in this order: E, C, D with the source currency omitted.
- The original result-row price node is `span[data-field="price"]`. Insert target buttons after `.price-label`; insert the converted value inside the same price node after the original price line.
- Currency icons are local extension assets under `images/currency/`. Keep them declared in `manifest.json` web-accessible resources.

## UI Style

- Match the Path of Exile trade site's visual language for injected UI: translucent dark brown and charcoal surfaces, aged gold or brass borders, ivory and muted amber text, and restrained warm red only for errors.
- Do not introduce green, teal, blue, purple, neon, or highly saturated accent colors in extension controls, status states, icons, gradients, outlines, or shadows.
- Keep injected controls compact and visually subordinate to native trade listing content. Reuse the page's spacing, serif typography, and understated metallic treatment where practical.
- When adding or changing extension raster or vector assets, keep their palette aligned with the same dark brown and aged-gold treatment.

## Verification

Run the full test suite after behavior changes:

```bash
uv run --project scripts python -m unittest discover -s scripts/tests -p 'test_*.py'
```

For JavaScript or manifest changes, also run:

```bash
node --check background.js
node --check content.js
node --check page-bridge.js
node --check currency-conversion.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
git diff --check
```

Use the smallest relevant test while iterating, then run the full suite before delivery. Reload the unpacked extension and refresh the trade page to manually verify UI and page-context changes.

## Release Packaging

- Before creating a release tag, build the extension into a temporary directory and validate the packaged `manifest.json`, not only the source tree.
- The release package must include every manifest icon, action icon, background service worker, content-script JavaScript and CSS file, default-locale message file, and every web-accessible resource.
- Expand and validate globbed web-accessible resources such as `images/currency/*.png`; do not treat a glob pattern as a literal file path.
- When a new content script or local asset is added, update `.github/workflows/release.yml` packaging commands in the same change and run the equivalent local package validation before release.
