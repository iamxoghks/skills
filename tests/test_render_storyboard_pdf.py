from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
RENDERER_PATH = ROOT / "skills/storyboard-builder/scripts/render_storyboard_pdf.py"
sys.dont_write_bytecode = True


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


renderer = load_module(RENDERER_PATH, "render_storyboard_pdf")


class RendererTests(unittest.TestCase):
    def test_parse_preflight_result(self) -> None:
        report = {"totalPages": 3, "splitPages": 1, "oversized": []}
        value = renderer.PREFLIGHT_SENTINEL + json.dumps(report)
        output = "### Result\n" + json.dumps(value) + "\n### Ran Playwright code\n"
        self.assertEqual(renderer.parse_preflight_output(output), report)

    def test_preflight_code_contains_pagination_contract(self) -> None:
        code = renderer.preflight_code(True)
        self.assertIn("replaceChildren", code)
        self.assertIn("data-cut-number", code)
        self.assertIn(renderer.PREFLIGHT_SENTINEL, code)

    def test_explicit_backend_is_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            executable = Path(temporary) / "playwright-cli"
            executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            executable.chmod(0o755)
            command, source = renderer.playwright_command(str(executable))
            self.assertEqual(command, [str(executable.resolve())])
            self.assertEqual(source, "configured")

    def test_npx_is_the_portable_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            with mock.patch.dict(os.environ, {"CODEX_HOME": temporary}, clear=True):
                with mock.patch.object(
                    renderer.shutil,
                    "which",
                    side_effect=lambda executable: (
                        "/usr/local/bin/npx" if executable == "npx" else None
                    ),
                ):
                    command, source = renderer.playwright_command()
        self.assertEqual(
            command,
            [
                "/usr/local/bin/npx",
                "--yes",
                "--package",
                "@playwright/cli",
                "playwright-cli",
            ],
        )
        self.assertEqual(source, "npx")

    def test_playwright_environment_drops_unrelated_secrets(self) -> None:
        source = {
            "HOME": "/tmp/home",
            "PATH": "/usr/bin:/bin",
            "OPENAI_API_KEY": "not-exported",
            "UNRELATED_TOKEN": "not-exported",
        }
        with mock.patch.dict(os.environ, source, clear=True):
            environment = renderer.playwright_environment("test-session")
        self.assertEqual(environment["HOME"], "/tmp/home")
        self.assertEqual(environment["PLAYWRIGHT_CLI_SESSION"], "test-session")
        self.assertNotIn("OPENAI_API_KEY", environment)
        self.assertNotIn("UNRELATED_TOKEN", environment)


if __name__ == "__main__":
    unittest.main()
