from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANALYZER_PATH = ROOT / "storyboard-builder/scripts/analyze_video.py"
sys.dont_write_bytecode = True


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


analyzer = load_module(ANALYZER_PATH, "analyze_video")


class AnalyzerTests(unittest.TestCase):
    def test_parse_fraction(self) -> None:
        self.assertAlmostEqual(analyzer.parse_fraction("30000/1001"), 29.970, places=3)
        self.assertIsNone(analyzer.parse_fraction("0/0"))

    def test_sample_times_preserve_boundaries(self) -> None:
        times = analyzer.choose_sample_times([0.5, 1.0, 1.5, 2.0], 2.5, 3)
        self.assertEqual(times[0], 0.0)
        self.assertEqual(times[-1], 2.45)
        self.assertEqual(len(times), 3)

    def test_scene_pattern(self) -> None:
        log = "n:1 pts:24 pts_time:1.000 pos:1\nn:2 pts:48 pts_time:2.000 pos:2"
        values = [float(match.group(1)) for match in analyzer.SCENE_TIME_PATTERN.finditer(log)]
        self.assertEqual(values, [1.0, 2.0])


if __name__ == "__main__":
    unittest.main()
