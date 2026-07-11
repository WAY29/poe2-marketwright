"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runScript } = require("./helpers/run-script");

test("refresh bypasses runtime poe2scout rate cache", async () => {
  const result = await runScript(`
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
            `);
  assert.deepStrictEqual(result["first"]["ok"], true);
  assert.deepStrictEqual(result["cached"]["ok"], true);
  assert.deepStrictEqual(result["refreshed"]["ok"], true);
  assert.deepStrictEqual(result["fetchCalls"], ["https://api.poe2scout.com/poe2/Leagues/Runes%20of%20Aldur/ReferenceCurrencies", "https://api.poe2scout.com/poe2/Leagues/Runes%20of%20Aldur/ReferenceCurrencies"]);
});

test("does not replace the trade league after a failed reference request", async () => {
  const result = await runScript(`
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
            `);
  assert.deepStrictEqual(result["response"]["ok"], false);
  assert.deepStrictEqual(result["fetchCalls"], ["https://api.poe2scout.com/poe2/Leagues/Runes%20of%20Aldur/ReferenceCurrencies"]);
});

test("failed reference request returns request diagnostics", async () => {
  const result = await runScript(`
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
            `);
  assert.deepStrictEqual(result["ok"], false);
  assert.deepStrictEqual(result["details"]["requestedLeague"], "Unknown League");
  assert.deepStrictEqual(result["details"]["force"], true);
  assert.deepStrictEqual(result["details"]["status"], 400);
  assert.deepStrictEqual(result["details"]["responseBody"], ": league unavailable");
  assert.deepStrictEqual(result["details"]["queryId"], "query-unknown");
  assert.deepStrictEqual(result["details"]["searchUrl"], "https://www.pathofexile.com/api/trade2/search/Unknown%20League");
  assert.deepStrictEqual(result["details"]["tradeUrl"], "https://www.pathofexile.com/api/trade2/fetch/item-1?query=query-unknown");
  assert.deepStrictEqual(result["details"]["requestUrl"], "https://api.poe2scout.com/poe2/Leagues/Unknown%20League/ReferenceCurrencies");
});
