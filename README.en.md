# Storyboard Builder

[한국어](README.md) | **English**

Storyboard Builder is a Codex skill for turning either reference videos or
scripts containing dialogue, framing, and character actions into detailed,
production-ready shooting boards. Without a video, it designs cuts, framing,
blocking, reactions, and approximate timing from a script or brief. It creates
one original hand-drawn 16:9 frame per cut, keeps essential action inside a
central 9:16-safe area, and exports localized HTML, Markdown, and paginated A4
PDF.

![English A4 storyboard preview](storyboard-builder/examples/sample-storyboard-preview-en.png)

## Accepted Inputs

- Reference video: preserve source shot order, timing, composition, poses, and movement.
- Detailed script: follow dialogue, framing, character actions, reactions, props, and transitions.
- Dialogue-only script or brief: design the missing cuts, blocking, silent reactions, and approximate timing.
- Existing storyboard or visual references: analyze structure and style while creating new final artwork.

## Features

- Reference-video probing, scene-change detection, and representative frames
- Detailed cuts for dialogue, gestures, props, reactions, and silent behavior
- Original 16:9 hand-drawn frames with central 9:16 crop guides
- Korean primary templates and examples, English secondary versions, and custom-label support
- Optional cover framing guide for the 16:9 frame and central 9:16 safe area
- Metadata-sanitized PNG, JPEG, and WebP asset copying by default
- A4 PDF rendering with automatic overflow pagination
- HTML, Markdown, JSON manifest, PDF, and image deliverables
- Local-path, basename, Markdown, and privacy validation

## Requirements

- Codex with image generation for creating new storyboard artwork
- Python 3.10 or newer
- Node.js with `npx`, a `playwright-cli` executable, or the Codex Playwright skill for PDF output
- FFmpeg (`ffmpeg` and `ffprobe`) for optional video analysis
- Optional: `pypdf` or `pdfinfo` for PDF page-count verification
- Optional: Pillow or macOS `sips` for PDF image optimization

## Install

From this repository:

```bash
./scripts/install.sh
```

The installer copies `storyboard-builder` to:

```text
${CODEX_HOME:-$HOME/.codex}/skills/storyboard-builder
```

It does not overwrite an existing installation unless `--force` is supplied.

## Use In Codex

```text
Use $storyboard-builder to turn this reference video or script into a detailed
shooting storyboard. Design any missing cuts, framing, and character actions,
then create original hand-drawn frames and an A4 PDF.
```

The installed skill contains the full workflow. Use
`storyboard-builder/assets/storyboard.template.en.json` for an English
document. The unsuffixed template is the primary Korean version.

## Command-Line Tools

Build HTML and Markdown:

```bash
python3 storyboard-builder/scripts/storyboard_builder.py storyboard.json \
  --output-dir outputs \
  --basename project-storyboard
```

Render A4 PDF:

```bash
python3 storyboard-builder/scripts/render_storyboard_pdf.py \
  outputs/project-storyboard.html \
  outputs/project-storyboard.pdf
```

Analyze a reference video:

```bash
python3 storyboard-builder/scripts/analyze_video.py reference.mp4 \
  --output-dir work/video-analysis
```

## Examples

- [Example manifest](storyboard-builder/examples/sample-storyboard-en.json)
- [Example HTML](storyboard-builder/examples/sample-storyboard-en.html)
- [Example Markdown](storyboard-builder/examples/sample-storyboard-en.md)
- [Example A4 PDF](storyboard-builder/examples/sample-storyboard-en.pdf)

The primary Korean examples use the same filenames without the `-en` suffix.

The example uses generated fictional adults and contains no source-video
captures, real names, local absolute paths, or project-specific dialogue.

## Privacy Defaults

- Reusable files do not store local absolute paths or account names.
- The builder removes common personal and editor metadata from PNG, JPEG, and WebP files while preserving image data needed for reliable display.
- The video analyzer omits the source filename unless explicitly requested.
- Extracted video frames remain local analysis material.
- Image generation is an external service boundary; do not send confidential
  source material unless that use is intended and authorized.

## Test

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 tests/smoke_test.py
```

The GitHub Actions workflow installs the required runtimes and executes both
commands on Linux.

## License And Attribution

Storyboard Builder is released under the MIT License. Its hand-drawn visual
direction was informed by
[Ian Xiaohei Illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations),
also released under the MIT License. See [NOTICE.md](NOTICE.md).
