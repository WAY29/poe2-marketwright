import json
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class CurrencyBackgroundBehaviorTests(unittest.TestCase):
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

    def test_refresh_bypasses_runtime_poe2scout_rate_cache(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            let messageListener;
            const fetchCalls = [];
            const sandbox = {
              chrome: {
                runtime: {
                  onMessage: {
                    addListener(listener) {
                      messageListener = listener;
                    }
                  }
                }
              },
              fetch(url) {
                fetchCalls.push(url);
                return Promise.resolve({
                  ok: true,
                  json() {
                    return Promise.resolve([
                      { ApiId: "exalted", RelativePrice: 1 },
                      { ApiId: "chaos", RelativePrice: 75 },
                      { ApiId: "divine", RelativePrice: 600 }
                    ]);
                  }
                });
              }
            };
            vm.runInNewContext(fs.readFileSync("background.js", "utf8"), sandbox, {
              filename: "background.js"
            });

            const send = (message) => new Promise((resolve) => messageListener(message, {}, resolve));
            const first = await send({ type: "fetch-poe2scout-reference-currencies", league: "Runes of Aldur" });
            const cached = await send({ type: "fetch-poe2scout-reference-currencies", league: "Runes of Aldur" });
            const refreshed = await send({
              type: "fetch-poe2scout-reference-currencies",
              league: "Runes of Aldur",
              force: true
            });

            console.log(JSON.stringify({ first, cached, refreshed, fetchCalls }));
            })();
            ''',
        )

        self.assertEqual(result["first"]["ok"], True)
        self.assertEqual(result["cached"]["ok"], True)
        self.assertEqual(result["refreshed"]["ok"], True)
        self.assertEqual(
            result["fetchCalls"],
            [
                "https://api.poe2scout.com/poe2/Leagues/Runes%20of%20Aldur/ReferenceCurrencies",
                "https://api.poe2scout.com/poe2/Leagues/Runes%20of%20Aldur/ReferenceCurrencies",
            ],
        )

    def test_does_not_replace_the_trade_league_after_a_failed_reference_request(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            let messageListener;
            const fetchCalls = [];
            const sandbox = {
              chrome: {
                runtime: {
                  onMessage: {
                    addListener(listener) {
                      messageListener = listener;
                    }
                  }
                }
              },
              fetch(url) {
                fetchCalls.push(url);
                return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve("invalid league") });
              }
            };
            vm.runInNewContext(fs.readFileSync("background.js", "utf8"), sandbox, {
              filename: "background.js"
            });

            const response = await new Promise((resolve) => {
              messageListener(
                { type: "fetch-poe2scout-reference-currencies", league: "Runes of Aldur" },
                {},
                resolve
              );
            });
            console.log(JSON.stringify({ response, fetchCalls }));
            })();
            ''',
        )

        self.assertEqual(result["response"]["ok"], False)
        self.assertEqual(
            result["fetchCalls"],
            [
                "https://api.poe2scout.com/poe2/Leagues/Runes%20of%20Aldur/ReferenceCurrencies",
            ],
        )

    def test_failed_reference_request_returns_request_diagnostics(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            let messageListener;
            const sandbox = {
              console: { error() {} },
              chrome: {
                runtime: {
                  onMessage: {
                    addListener(listener) {
                      messageListener = listener;
                    }
                  }
                }
              },
              fetch(url) {
                if (url.endsWith("/poe2/Leagues")) {
                  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
                }
                return Promise.resolve({
                  ok: false,
                  status: 400,
                  statusText: "Bad Request",
                  url,
                  text: () => Promise.resolve("league unavailable")
                });
              }
            };
            vm.runInNewContext(fs.readFileSync("background.js", "utf8"), sandbox, {
              filename: "background.js"
            });

            const response = await new Promise((resolve) => {
              messageListener(
                {
                  type: "fetch-poe2scout-reference-currencies",
                  league: "Unknown League",
                  force: true,
                  queryId: "query-unknown",
                  searchUrl: "https://www.pathofexile.com/api/trade2/search/Unknown%20League",
                  tradeUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1?query=query-unknown"
                },
                {},
                resolve
              );
            });
            console.log(JSON.stringify(response));
            })();
            ''',
        )

        self.assertEqual(result["ok"], False)
        self.assertEqual(result["details"]["requestedLeague"], "Unknown League")
        self.assertEqual(result["details"]["force"], True)
        self.assertEqual(result["details"]["status"], 400)
        self.assertEqual(result["details"]["responseBody"], ": league unavailable")
        self.assertEqual(result["details"]["queryId"], "query-unknown")
        self.assertEqual(
            result["details"]["searchUrl"],
            "https://www.pathofexile.com/api/trade2/search/Unknown%20League",
        )
        self.assertEqual(
            result["details"]["tradeUrl"],
            "https://www.pathofexile.com/api/trade2/fetch/item-1?query=query-unknown",
        )
        self.assertEqual(
            result["details"]["requestUrl"],
            "https://api.poe2scout.com/poe2/Leagues/Unknown%20League/ReferenceCurrencies",
        )


if __name__ == "__main__":
    unittest.main()
