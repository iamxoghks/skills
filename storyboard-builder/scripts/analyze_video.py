#!/usr/bin/env python3
"""Probe a reference video and extract privacy-conscious storyboard samples."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


SCENE_TIME_PATTERN = re.compile(r"\bpts_time:([0-9]+(?:\.[0-9]+)?)")


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe video metadata, detect scene changes, and extract sample frames."
    )
    parser.add_argument("video", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--scene-threshold", type=float, default=0.35)
    parser.add_argument("--max-frames", type=int, default=24)
    parser.add_argument("--max-frame-width", type=int, default=1280)
    parser.add_argument("--no-scene-detection", action="store_true")
    parser.add_argument("--no-frames", action="store_true")
    parser.add_argument("--include-source-name", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def require_command(name: str) -> str:
    command = shutil.which(name)
    if command is None:
        fail(f"{name} is required; install FFmpeg and retry")
    return command


def parse_fraction(value: str | None) -> float | None:
    if not value or value in {"0/0", "N/A"}:
        return None
    if "/" not in value:
        try:
            return float(value)
        except ValueError:
            return None
    numerator, denominator = value.split("/", 1)
    try:
        denominator_value = float(denominator)
        return float(numerator) / denominator_value if denominator_value else None
    except ValueError:
        return None


def probe_video(video: Path, ffprobe: str) -> dict:
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "format=duration:stream=codec_name,width,height,avg_frame_rate,r_frame_rate",
            "-of",
            "json",
            str(video),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        fail(f"ffprobe returned invalid JSON: {exc}")
    streams = payload.get("streams", [])
    if not streams:
        fail("video has no readable video stream")
    stream = streams[0]
    try:
        duration = float(payload.get("format", {}).get("duration"))
    except (TypeError, ValueError):
        fail("video duration is unavailable")
    frame_rate = parse_fraction(stream.get("avg_frame_rate"))
    if frame_rate is None:
        frame_rate = parse_fraction(stream.get("r_frame_rate"))
    return {
        "duration_seconds": round(duration, 3),
        "width": int(stream.get("width", 0)),
        "height": int(stream.get("height", 0)),
        "frame_rate": round(frame_rate, 3) if frame_rate is not None else None,
        "codec": stream.get("codec_name"),
    }


def detect_scene_times(
    video: Path, ffmpeg: str, threshold: float
) -> tuple[list[float], str]:
    filter_expression = f"select='gt(scene,{threshold})',showinfo"
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-nostats",
            "-i",
            str(video),
            "-an",
            "-vf",
            filter_expression,
            "-f",
            "null",
            "-",
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        return [], "ffmpeg scene detection failed"
    times = [float(match.group(1)) for match in SCENE_TIME_PATTERN.finditer(result.stderr)]
    return sorted(set(times)), ""


def choose_sample_times(
    scene_times: list[float], duration: float, max_frames: int
) -> list[float]:
    last_time = max(0.0, duration - 0.05)
    candidates = [0.0, *scene_times]
    if last_time > 0.08:
        candidates.append(last_time)
    candidates = sorted(max(0.0, min(last_time, value)) for value in candidates)

    deduplicated: list[float] = []
    for value in candidates:
        if not deduplicated or value - deduplicated[-1] >= 0.08:
            deduplicated.append(value)
    if len(deduplicated) <= max_frames:
        return [round(value, 3) for value in deduplicated]
    if max_frames == 1:
        return [round(deduplicated[0], 3)]

    indexes = {
        round(index * (len(deduplicated) - 1) / (max_frames - 1))
        for index in range(max_frames)
    }
    return [round(deduplicated[index], 3) for index in sorted(indexes)]


def extract_frame(
    video: Path,
    destination: Path,
    time_seconds: float,
    max_width: int,
    ffmpeg: str,
) -> None:
    subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-ss",
            f"{time_seconds:.3f}",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-vf",
            f"scale='min(iw,{max_width})':-2",
            "-map_metadata",
            "-1",
            "-q:v",
            "2",
            "-y",
            str(destination),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def run() -> None:
    args = parse_args()
    video = args.video.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    if not video.is_file():
        fail(f"video not found: {video}")
    if not 0 <= args.scene_threshold <= 1:
        fail("scene-threshold must be between 0 and 1")
    if args.max_frames < 1:
        fail("max-frames must be at least 1")
    if args.max_frame_width < 320:
        fail("max-frame-width must be at least 320")

    analysis_path = output_dir / "analysis.json"
    frame_dir = output_dir / "frames"
    if not args.force and (analysis_path.exists() or frame_dir.exists()):
        fail("output already exists; choose another directory or pass --force")
    if args.force:
        if analysis_path.exists():
            analysis_path.unlink()
        if frame_dir.exists():
            shutil.rmtree(frame_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    if not args.no_frames:
        frame_dir.mkdir(parents=True, exist_ok=True)

    ffprobe = require_command("ffprobe")
    ffmpeg = require_command("ffmpeg")
    metadata = probe_video(video, ffprobe)
    scene_times: list[float] = []
    scene_warning = ""
    if not args.no_scene_detection:
        scene_times, scene_warning = detect_scene_times(
            video, ffmpeg, args.scene_threshold
        )

    sample_times = choose_sample_times(
        scene_times, float(metadata["duration_seconds"]), args.max_frames
    )
    frames = []
    if not args.no_frames:
        for index, time_seconds in enumerate(sample_times, start=1):
            destination = frame_dir / f"frame-{index:03d}.jpg"
            extract_frame(
                video, destination, time_seconds, args.max_frame_width, ffmpeg
            )
            frames.append(
                {
                    "index": index,
                    "time_seconds": time_seconds,
                    "image": destination.relative_to(output_dir).as_posix(),
                }
            )

    report = {
        "source_name": video.name if args.include_source_name else None,
        "video": metadata,
        "scene_detection": {
            "enabled": not args.no_scene_detection,
            "threshold": args.scene_threshold,
            "detected_changes": len(scene_times),
            "times_seconds": [round(value, 3) for value in scene_times],
            "warning": scene_warning or None,
        },
        "sample_frames": frames,
    }
    analysis_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Analysis: {analysis_path}")
    print(f"Duration: {metadata['duration_seconds']} seconds")
    print(f"Scene changes: {len(scene_times)}")
    print(f"Sample frames: {len(frames)}")


if __name__ == "__main__":
    run()
