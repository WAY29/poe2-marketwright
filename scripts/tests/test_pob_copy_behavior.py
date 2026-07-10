import json
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class PobCopyBehaviorTests(unittest.TestCase):
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

    def test_pob_builder_outputs_create_custom_item_text(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
            const sandbox = { console };
            vm.runInNewContext(fs.readFileSync("pob-copy.js", "utf8"), sandbox, {
              filename: "pob-copy.js"
            });

            const builder = sandbox.Poe2MarketwrightPobCopy.createItemTextBuilder([
              { key: "implicitMods", tag: "implicit" },
              { key: "explicitMods", tag: null }
            ]);
            const text = builder.buildPobFullText({
              rarity: "Rare",
              name: "Dawn Veil",
              typeLine: "Expert Omen Wand",
              properties: [{ name: "[Quality]", values: [["+20%"]] }],
              implicitMods: [{ description: "[explicit.stat_fire|+20% to Fire Resistance]" }],
              explicitMods: [
                { description: "+30 to Spirit" },
                { description: "+12% increased Attack Speed" },
                { description: "# to skip this placeholder" }
              ]
            });

            console.log(JSON.stringify(text.split("\n")));
            ''',
        )

        self.assertEqual(
            result,
            [
                "Rarity: RARE",
                "Dawn Veil",
                "Expert Omen Wand",
                "Quality: 20",
                "Implicits: 1",
                "{implicit}+20% to Fire Resistance",
                "+30 to Spirit",
                "+12% increased Attack Speed",
            ],
        )

    def test_page_bridge_forwards_trade_fetch_when_pob_copy_is_enabled(self) -> None:
        result = self.run_node(
            r'''
            (async () => {
            const fs = require("fs");
            const vm = require("vm");
            const listeners = [];
            const messages = [];
            const responseBody = JSON.stringify({ result: [{ id: "item-1", item: { name: "Dawn Veil" } }] });
            const window = {
              app: { $data: { static_: { knownStats: [] } } },
              addEventListener(type, listener) {
                if (type === "message") listeners.push(listener);
              },
              postMessage(message) {
                messages.push(message);
              },
              fetch() {
                return Promise.resolve({
                  clone() {
                    return { text: () => Promise.resolve(responseBody) };
                  }
                });
              }
            };

            vm.runInNewContext(fs.readFileSync("page-bridge.js", "utf8"), {
              window,
              console
            }, { filename: "page-bridge.js" });

            listeners[0]({
              source: window,
              data: {
                source: "poe2-marketwright",
                type: "POE2_MARKETWRIGHT_UPDATE",
                payload: { enabled: false, pobCopyEnabled: true }
              }
            });
            await window.fetch("/api/trade2/fetch/query-1");
            await new Promise((resolve) => setTimeout(resolve, 0));

            console.log(JSON.stringify(messages.filter((message) => message.source === "poe2-marketwright-pob-copy")));
            })();
            ''',
        )

        self.assertEqual(
            result,
            [
                {
                    "source": "poe2-marketwright-pob-copy",
                    "url": "/api/trade2/fetch/query-1",
                    "body": '{"result":[{"id":"item-1","item":{"name":"Dawn Veil"}}]}',
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
