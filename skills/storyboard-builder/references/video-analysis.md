# Reference Video Analysis

Use the bundled analyzer when a local reference video must be matched for
timing, composition, or scene order.

    python3 scripts/analyze_video.py reference.mp4 \
      --output-dir work/video-analysis

The script requires `ffprobe` and `ffmpeg`. It writes:

- `analysis.json`: duration, dimensions, frame rate, codec, scene-change times, and sample-frame records.
- `frames/frame-*.jpg`: metadata-free representative frames for analysis only.

Defaults:

- Scene threshold: `0.35`
- Maximum frames: `24`
- Maximum frame width: `1280`
- Source filename omitted from `analysis.json`

Useful options:

- `--scene-threshold 0.25`: detect smaller visual changes.
- `--max-frames 40`: retain more representative times.
- `--no-scene-detection`: sample only the beginning and end.
- `--no-frames`: write metadata and scene times only.
- `--include-source-name`: include only the basename, never the absolute path.
- `--force`: replace a previous analyzer output directory.

Treat extracted frames as private source-analysis material. Do not place them
in a public package or use them as final storyboard art unless the user
explicitly requests it and has the right to do so.
