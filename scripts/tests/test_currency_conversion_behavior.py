import json
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class CurrencyConversionBehaviorTests(unittest.TestCase):
    def run_node(self, script: str) -> object:
        result = subprocess.run(
            ["node", "-e", textwrap.dedent(script)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            self.fail(result.stderr or result.stdout)
        return json.loads(result.stdout)

    def test_extracts_selected_league_and_converts_ecd_listing_currency(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("currency-conversion.js", "utf8"), sandbox, {
              filename: "currency-conversion.js"
            });

            const tools = sandbox.Poe2MarketwrightCurrencyConversion.createConversionTools();
            const listing = tools.readListingPrice({
              id: "item-1",
              listing: { price: { type: "~price", amount: 3, currency: "exalted" } }
            });
            const rates = tools.createRateMap([
              { apiId: "exalted", relativePrice: 1 },
              { apiId: "chaos", relativePrice: 75 },
              { apiId: "divine", relativePrice: 600 }
            ]);

            console.log(JSON.stringify({
              league: tools.getLeagueFromTradeUrl(
                "https://www.pathofexile.com/trade2/search/HC%20Runes%20of%20Aldur/query-1"
              ),
              delayedLeague: tools.resolveMessageLeague("Dawn of the Hunt", "Runes of Aldur"),
              missingLeague: tools.resolveMessageLeague(null, "Runes of Aldur"),
              listing,
              chaos: tools.convert(3, rates.get("exalted"), rates.get("chaos")),
              divine: tools.convert(3, rates.get("exalted"), rates.get("divine")),
              chaosToDivine: tools.convert(150, rates.get("chaos"), rates.get("divine")),
              divineToChaos: tools.convert(2, rates.get("divine"), rates.get("chaos")),
              display: tools.formatAmount(0.005),
              targetsFromExalted: tools.getConversionTargets("exalted"),
              targetsFromChaos: tools.getConversionTargets("chaos"),
              targetsFromDivine: tools.getConversionTargets("divine"),
              exaltedSymbol: tools.getCurrencySymbol("exalted"),
              divineIconPath: tools.getCurrencyIconPath("divine")
            }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "league": "HC Runes of Aldur",
                "delayedLeague": "Dawn of the Hunt",
                "missingLeague": "Runes of Aldur",
                "listing": {"amount": 3, "currency": "exalted"},
                "chaos": 0.04,
                "divine": 0.005,
                "chaosToDivine": 18.75,
                "divineToChaos": 16,
                "display": "0.005",
                "targetsFromExalted": ["chaos", "divine"],
                "targetsFromChaos": ["exalted", "divine"],
                "targetsFromDivine": ["exalted", "chaos"],
                "exaltedSymbol": "E",
                "divineIconPath": "images/currency/divine-orb.png",
            },
        )

    def test_accepts_fixed_buyout_prices_and_ignores_non_ecd_or_non_fixed_listings(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("currency-conversion.js", "utf8"), sandbox, {
              filename: "currency-conversion.js"
            });

            const tools = sandbox.Poe2MarketwrightCurrencyConversion.createConversionTools();
            console.log(JSON.stringify({
              note: tools.readListingPrice({ listing: { price: { type: "~price", amount: 2, currency: "exalted" } } }),
              buyout: tools.readListingPrice({ listing: { price: { type: "~b/o", amount: 2, currency: "divine" } } }),
              negotiable: tools.readListingPrice({ listing: { price: { type: "~note", amount: 2, currency: "exalted" } } }),
              unsupported: tools.readListingPrice({ listing: { price: { type: "~price", amount: 2, currency: "vaal" } } }),
              missing: tools.readListingPrice({ listing: {} }),
              invalid: tools.convert(2, 0, 10)
            }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "note": {"amount": 2, "currency": "exalted"},
                "buyout": {"amount": 2, "currency": "divine"},
                "negotiable": None,
                "unsupported": None,
                "missing": None,
                "invalid": None,
            },
        )

    def test_refresh_uses_the_league_from_the_current_trade_search_url(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            const requests = [];
            const leagues = [];
            const sandbox = {
              console,
              document: {
                querySelectorAll() {
                  return [];
                }
              },
              location: {
                href: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/QLBP87yeHw"
              },
              chrome: {
                runtime: {
                  sendMessage(message, callback) {
                    requests.push(message);
                    callback({
                      ok: true,
                      rates: [
                        { ApiId: "exalted", RelativePrice: 1 },
                        { ApiId: "chaos", RelativePrice: 75 },
                        { ApiId: "divine", RelativePrice: 600 }
                      ]
                    });
                  }
                }
              }
            };
            vm.runInNewContext(fs.readFileSync("currency-conversion.js", "utf8"), sandbox, {
              filename: "currency-conversion.js"
            });

            const feature = sandbox.Poe2MarketwrightCurrencyConversion.createCurrencyConversionFeature({
              onLeagueChange(league, searchUrl) {
                leagues.push({ league, searchUrl });
              }
            });
            await feature.refresh();
            console.log(JSON.stringify({ requests, leagues }));
            })();
            ''',
        )

        self.assertEqual(
            result,
            {
                "requests": [
                    {
                        "type": "fetch-poe2scout-reference-currencies",
                        "league": "Runes of Aldur",
                        "force": True,
                        "queryId": None,
                        "searchUrl": "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/QLBP87yeHw",
                        "tradeUrl": None,
                    }
                ],
                "leagues": [
                    {
                        "league": "Runes of Aldur",
                        "searchUrl": "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/QLBP87yeHw",
                    }
                ],
            },
        )

    def test_places_buttons_after_the_price_label_and_value_after_the_price_field(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");

            class FakeNode {
              constructor(tagName, textContent = "") {
                this.tagName = tagName;
                this.textContent = textContent;
                this.className = "";
                this.children = [];
                this.after = [];
                this.attributes = {};
                this.dataset = {};
                this.style = {};
              }

              appendChild(node) {
                this.children.push(node);
                return node;
              }

              append(...nodes) {
                nodes.forEach((node) => this.appendChild(node));
              }

              insertAdjacentElement(position, node) {
                if (position === "afterend") {
                  this.after.push(node);
                }
                return node;
              }

              setAttribute(name, value) {
                this.attributes[name] = String(value);
              }

              getAttribute(name) {
                return this.attributes[name] || null;
              }

              addEventListener() {}

              querySelectorAll() {
                return [];
              }

              querySelector() {
                return null;
              }
            }

            const priceLabel = new FakeNode("span", "Asking Price:");
            const priceBreak = new FakeNode("br");
            const originalPriceValue = new FakeNode("span", "1");
            priceBreak.nextElementSibling = originalPriceValue;
            const priceField = new FakeNode("span", "Asking Price: 1x Divine Orb");
            priceField.querySelector = (selector) => {
              if (selector === ".price-label.buyout-price, .price-label") return priceLabel;
              if (selector === "br") return priceBreak;
              return null;
            };
            const row = new FakeNode("div");
            row.attributes["data-id"] = "item-1";
            row.querySelector = (selector) => {
              if (selector === '[data-field="price"]') return priceField;
              return null;
            };
            const document = {
              createElement(tagName) {
                return new FakeNode(tagName);
              },
              querySelectorAll(selector) {
                return selector === "div.row[data-id]" ? [row] : [];
              }
            };
            const sandbox = { console, document, Element: FakeNode };
            vm.runInNewContext(fs.readFileSync("currency-conversion.js", "utf8"), sandbox, {
              filename: "currency-conversion.js"
            });

            const feature = sandbox.Poe2MarketwrightCurrencyConversion.createCurrencyConversionFeature();
            feature.storeResults(
              {
                result: [
                  { id: "item-1", listing: { price: { type: "~price", amount: 1, currency: "divine" } } }
                ]
              },
              "Runes of Aldur"
            );

            const controls = priceLabel.after[0];
            console.log(JSON.stringify({
              buttons: controls.children.map((button) => button.textContent),
              valueBreakClass: priceField.children[0]?.className || null,
              valueClass: priceField.children[1]?.className || null,
              priceFieldAfter: priceField.after.length
            }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "buttons": ["E", "C"],
                "valueBreakClass": "poe2-marketwright-currency-conversion-break",
                "valueClass": "poe2-marketwright-currency-conversion-value",
                "priceFieldAfter": 0,
            },
        )


if __name__ == "__main__":
    unittest.main()
