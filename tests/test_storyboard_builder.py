from __future__ import annotations

import importlib.util
import contextlib
import io
import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "storyboard-builder"
BUILDER_PATH = SKILL / "scripts/storyboard_builder.py"
sys.dont_write_bytecode = True


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


builder = load_module(BUILDER_PATH, "storyboard_builder")


def png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + chunk_type
        + payload
        + struct.pack(">I", zlib.crc32(chunk_type + payload) & 0xFFFFFFFF)
    )


def write_test_png(path: Path) -> None:
    raw_pixel = b"\x00\xff\xff\xff"
    image = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + png_chunk(b"tEXt", b"private\x00local-value")
        + png_chunk(b"IDAT", zlib.compress(raw_pixel))
        + png_chunk(b"IEND", b"")
    )
    path.write_bytes(image)


def sample_manifest(image: Path) -> dict:
    return {
        "title": "<script>alert(1)</script>",
        "html_lang": "ko",
        "include_cover": False,
        "cuts": [
            {
                "number": 1,
                "start": "00:00",
                "end": "00:01",
                "duration": "1초",
                "scene": "장면 <b>하나</b>",
                "shot": "클로즈업",
                "action": "손을 든다.",
                "vertical_crop": "얼굴을 중앙에 둔다.",
                "dialogue": "발표자: 시작합니다 | 지금",
                "sound": "정적",
                "image": str(image),
            }
        ],
    }


class BuilderTests(unittest.TestCase):
    def test_build_strips_metadata_and_escapes_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            image = root / "source.png"
            write_test_png(image)
            manifest = root / "storyboard.json"
            manifest.write_text(json.dumps(sample_manifest(image)), encoding="utf-8")
            output = root / "output"
            subprocess.run(
                [
                    sys.executable,
                    str(BUILDER_PATH),
                    str(manifest),
                    "--output-dir",
                    str(output),
                    "--basename",
                    "sample",
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            copied = output / "sample_assets/cut-01.png"
            self.assertNotIn(b"tEXt", copied.read_bytes())
            html = (output / "sample.html").read_text(encoding="utf-8")
            markdown = (output / "sample.md").read_text(encoding="utf-8")
            self.assertIn("&lt;script&gt;", html)
            self.assertIn(">행동 메모<", html)
            self.assertNotIn("<script>", markdown)
            self.assertIn(r"\|", markdown)

    def test_basename_rejects_path_escape(self) -> None:
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                builder.validate_basename("../outside")
            with self.assertRaises(SystemExit):
                builder.validate_basename("folder/name")

    def test_framing_guide_requires_cover(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            image = root / "source.png"
            write_test_png(image)
            manifest = sample_manifest(image)
            manifest["include_cover"] = False
            manifest["include_framing_guide"] = True
            with contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    builder.validate_manifest(manifest, root)

    def test_binary_metadata_strippers(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            png = root / "source.png"
            stripped_png = root / "stripped.png"
            write_test_png(png)
            builder.strip_png_metadata(png, stripped_png)
            self.assertNotIn(b"tEXt", stripped_png.read_bytes())

            jpeg = root / "source.jpg"
            stripped_jpeg = root / "stripped.jpg"
            jpeg.write_bytes(
                b"\xff\xd8"
                + b"\xff\xe1\x00\x08Exif!!"
                + b"\xff\xda\x00\x02"
                + b"pixels"
                + b"\xff\xd9"
            )
            builder.strip_jpeg_metadata(jpeg, stripped_jpeg)
            self.assertNotIn(b"Exif", stripped_jpeg.read_bytes())

            webp = root / "source.webp"
            stripped_webp = root / "stripped.webp"
            chunks = b"VP8X" + struct.pack("<I", 1) + b"\x0c\x00" + b"EXIF" + struct.pack("<I", 4) + b"data"
            webp.write_bytes(b"RIFF" + struct.pack("<I", 4 + len(chunks)) + b"WEBP" + chunks)
            builder.strip_webp_metadata(webp, stripped_webp)
            payload = stripped_webp.read_bytes()
            self.assertNotIn(b"EXIF", payload)
            self.assertEqual(payload[20] & 0x0C, 0)

    def test_runnable_korean_and_english_examples_build(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            for basename, manifest_name, language, heading, guide_title in [
                ("example-ko", "sample-storyboard.json", "ko", "행동 메모", "화면 구성 가이드"),
                ("example-en", "sample-storyboard-en.json", "en", "Action Notes", "Framing Guide"),
            ]:
                subprocess.run(
                    [
                        sys.executable,
                        str(BUILDER_PATH),
                        str(SKILL / "examples" / manifest_name),
                        "--output-dir",
                        temporary,
                        "--basename",
                        basename,
                    ],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
                html = (output / f"{basename}.html").read_text(encoding="utf-8")
                self.assertIn(f'<html lang="{language}">', html)
                self.assertIn(heading, html)
                self.assertIn('class="framing-guide"', html)
                self.assertIn(guide_title, html)


if __name__ == "__main__":
    unittest.main()
