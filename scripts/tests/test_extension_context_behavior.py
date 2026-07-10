import json
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class ExtensionContextBehaviorTests(unittest.TestCase):
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

    def test_save_state_ignores_invalidated_extension_context(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
            const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
            let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
            source = source.replace(
              /\n\}\)\(\);\s*$/,
              "\n  window.__testHooks = { saveState, runtime };\n})();"
            );

            const sandbox = {
              window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
              document: {},
              location: { pathname: "/trade2" },
              console,
              chrome: {
                storage: {
                  local: {
                    set() {
                      return Promise.reject(new Error("Extension context invalidated."));
                    }
                  }
                }
              }
            };
            vm.runInNewContext(source, sandbox, { filename: "content.js" });

            sandbox.PROMISE_RESULT = sandbox.window.__testHooks.saveState()
              .then(() => ({ resolved: true }))
              .catch((error) => ({ resolved: false, message: error.message }));
            sandbox.PROMISE_RESULT.then((result) => console.log(JSON.stringify(result)));
            ''',
        )

        self.assertEqual(result, {"resolved": True})

    def test_collapsed_panel_keeps_toggle_anchor_and_restores_saved_position(self) -> None:
        result = self.run_node(
            r'''
            const fs = require("fs");
            const vm = require("vm");
            const bootstrapCall = `  bootstrap().catch((error) => handleAsyncError(error, "bootstrap"));`;
            let source = fs.readFileSync("content.js", "utf8").replace(bootstrapCall, "");
            source = source.replace(
              /\n\}\)\(\);\s*$/,
              "\n  window.__testHooks = { applyPanelPosition, runtime };\n})();"
            );

            const sandbox = {
              window: { addEventListener() {}, innerWidth: 1280, innerHeight: 900 },
              document: {},
              location: { pathname: "/trade2" },
              console,
              chrome: {}
            };
            vm.runInNewContext(source, sandbox, { filename: "content.js" });

            const root = {
              style: {},
              getBoundingClientRect() {
                return { left: 240, top: 180, width: 36, height: 36 };
              }
            };
            const hooks = sandbox.window.__testHooks;
            hooks.runtime.ui.root = root;
            hooks.runtime.state = {
              collapsed: true,
              panelPosition: { left: 240, top: 180 },
              collapsedPosition: { left: 500, top: 300 }
            };
            hooks.applyPanelPosition();
            const collapsedStyle = { ...root.style };

            hooks.runtime.state.collapsed = false;
            hooks.applyPanelPosition();

            console.log(JSON.stringify({ collapsedStyle, expandedStyle: root.style }));
            ''',
        )

        self.assertEqual(
            result,
            {
                "collapsedStyle": {"left": "500px", "top": "300px", "right": "auto"},
                "expandedStyle": {"left": "240px", "top": "180px", "right": "auto"},
            },
        )


if __name__ == "__main__":
    unittest.main()
