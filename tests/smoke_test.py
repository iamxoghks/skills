from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "storyboard-builder"


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    required = ["ffmpeg", "ffprobe", "npx"]
    missing = [name for name in required if shutil.which(name) is None]
    if missing:
        raise SystemExit(f"missing smoke-test tools: {', '.join(missing)}")

    with tempfile.TemporaryDirectory(prefix="storyboard-smoke-") as temporary:
        root = Path(temporary)
        outputs = root / "outputs"
        run(
            [
                sys.executable,
                str(SKILL / "scripts/storyboard_builder.py"),
                str(SKILL / "examples/sample-storyboard.json"),
                "--output-dir",
                str(outputs),
                "--basename",
                "storyboard",
            ]
        )
        pdf = outputs / "storyboard.pdf"
        run(
            [
                sys.executable,
                str(SKILL / "scripts/render_storyboard_pdf.py"),
                str(outputs / "storyboard.html"),
                str(pdf),
            ]
        )
        if not pdf.is_file() or pdf.stat().st_size == 0:
            raise SystemExit("PDF smoke test failed")

        video = root / "synthetic.mp4"
        run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=red:s=640x360:d=0.6:r=24",
                "-f",
                "lavfi",
                "-i",
                "color=c=blue:s=640x360:d=0.6:r=24",
                "-filter_complex",
                "[0:v][1:v]concat=n=2:v=1:a=0",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-y",
                str(video),
            ]
        )
        analysis = root / "analysis"
        run(
            [
                sys.executable,
                str(SKILL / "scripts/analyze_video.py"),
                str(video),
                "--output-dir",
                str(analysis),
                "--scene-threshold",
                "0.2",
                "--max-frames",
                "4",
            ]
        )
        payload = json.loads((analysis / "analysis.json").read_text(encoding="utf-8"))
        if payload["source_name"] is not None:
            raise SystemExit("video analyzer leaked the source filename")

    print("Storyboard Builder smoke test passed")


if __name__ == "__main__":
    main()
