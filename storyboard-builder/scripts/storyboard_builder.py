#!/usr/bin/env python3
"""Build localized HTML and Markdown storyboard sheets from a JSON manifest."""

from __future__ import annotations

import argparse
import html
import json
import math
import shutil
import struct
import sys
from pathlib import Path


ENGLISH_LABELS = {
    "cut": "Cut",
    "picture": "Picture",
    "description": "Description",
    "duration": "Duration",
    "action": "Action Notes",
    "dialogue": "Dialogue",
    "sound": "Sound",
    "scene": "Scene",
    "shot": "Shot",
    "movement": "Action",
    "vertical_crop": "Vertical Crop",
    "page": "Page",
    "cast": "Cast",
    "format": "Format",
    "shooting": "Shooting Notes",
    "guide_title": "Framing Guide",
    "guide_frame": "Black outer border: the complete 16:9 landscape frame.",
    "guide_safe": "Blue vertical dashed lines: the central 9:16 safe area retained in a vertical crop.",
    "guide_sides": "Areas outside the dashed lines: visible in landscape but may be removed in a vertical export.",
    "guide_subject": "Keep essential faces, gestures, and props between the blue dashed lines.",
}

KOREAN_LABELS = {
    "cut": "컷",
    "picture": "그림",
    "description": "설명",
    "duration": "길이",
    "action": "행동 메모",
    "dialogue": "대사",
    "sound": "효과음",
    "scene": "장면명",
    "shot": "화면",
    "movement": "동작",
    "vertical_crop": "세로 전환",
    "page": "쪽",
    "cast": "등장인물",
    "format": "구성",
    "shooting": "촬영 기준",
    "guide_title": "화면 구성 가이드",
    "guide_frame": "검은 외곽선: 가로형으로 촬영되는 전체 16:9 화면입니다.",
    "guide_safe": "파란 세로 점선 사이: 세로형으로 잘라도 남는 중앙 9:16 안전 영역입니다.",
    "guide_sides": "점선 바깥 좌우 영역: 가로형에서는 보이지만 세로형 변환 시 잘릴 수 있습니다.",
    "guide_subject": "주요 얼굴과 손동작, 핵심 소품은 파란 점선 사이에 배치합니다.",
}

LABEL_SETS = {
    "en": ENGLISH_LABELS,
    "ko": KOREAN_LABELS,
}

SUPPORTED_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
PNG_PRIVATE_CHUNKS = {b"eXIf", b"iTXt", b"tEXt", b"tIME", b"zTXt"}

REQUIRED_CUT_FIELDS = (
    "start",
    "end",
    "duration",
    "scene",
    "shot",
    "action",
    "dialogue",
    "sound",
    "image",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build A4-ready storyboard HTML and Markdown from JSON."
    )
    parser.add_argument("manifest", type=Path, help="Storyboard JSON manifest")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--basename", help="Output filename without extension")
    parser.add_argument("--cuts-per-page", type=int)
    parser.add_argument(
        "--preserve-image-metadata",
        action="store_true",
        help="Keep embedded EXIF, XMP, comments, and text chunks in copied images.",
    )
    return parser.parse_args()


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(2)


def load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"manifest not found: {path}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")
    if not isinstance(data, dict):
        fail("manifest root must be an object")
    return data


def validate_basename(value: object) -> str:
    basename = str(value).strip()
    if not basename or basename in {".", ".."}:
        fail("basename must be a non-empty filename")
    if "/" in basename or "\\" in basename or "\x00" in basename:
        fail("basename must not contain path separators")
    if Path(basename).name != basename:
        fail("basename must not escape the output directory")
    return basename


def validate_manifest(data: dict, manifest_dir: Path) -> list[dict]:
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        fail("title must be a non-empty string")

    cuts = data.get("cuts")
    if not isinstance(cuts, list) or not cuts:
        fail("cuts must be a non-empty array")

    for field in ("include_cover", "include_framing_guide"):
        if field in data and not isinstance(data[field], bool):
            fail(f"{field} must be true or false")
    if data.get("include_framing_guide") and data.get("include_cover") is False:
        fail("include_framing_guide requires include_cover")

    normalized = []
    seen_numbers = set()
    for index, raw_cut in enumerate(cuts, start=1):
        if not isinstance(raw_cut, dict):
            fail(f"cut {index} must be an object")
        number = raw_cut.get("number", index)
        if not isinstance(number, int) or number < 1:
            fail(f"cut {index} has an invalid number")
        if number in seen_numbers:
            fail(f"duplicate cut number: {number}")
        seen_numbers.add(number)

        missing = [
            field
            for field in REQUIRED_CUT_FIELDS
            if field not in raw_cut or raw_cut[field] is None
        ]
        if missing:
            fail(f"cut {number} is missing: {', '.join(missing)}")

        image_path = Path(str(raw_cut["image"])).expanduser()
        if not image_path.is_absolute():
            image_path = (manifest_dir / image_path).resolve()
        if not image_path.is_file():
            fail(f"cut {number} image not found: {image_path}")
        if image_path.suffix.lower() not in SUPPORTED_IMAGE_SUFFIXES:
            supported = ", ".join(sorted(SUPPORTED_IMAGE_SUFFIXES))
            fail(f"cut {number} image must use one of: {supported}")

        cut = dict(raw_cut)
        cut["number"] = number
        cut["_source_image"] = image_path
        cut.setdefault("vertical_crop", "")
        normalized.append(cut)

    normalized.sort(key=lambda item: item["number"])
    return normalized


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def markdown_cell(value: object) -> str:
    return (
        html.escape(str(value), quote=False)
        .replace("|", r"\|")
        .replace("\n", "<br>")
    )


def markdown_inline(value: object) -> str:
    return html.escape(str(value), quote=False).replace("\n", " ")


def strip_png_metadata(source: Path, destination: Path) -> None:
    data = source.read_bytes()
    signature = b"\x89PNG\r\n\x1a\n"
    if not data.startswith(signature):
        fail(f"invalid PNG image: {source}")

    output = bytearray(signature)
    position = len(signature)
    saw_iend = False
    while position + 12 <= len(data):
        length = struct.unpack(">I", data[position : position + 4])[0]
        chunk_end = position + 12 + length
        if chunk_end > len(data):
            fail(f"truncated PNG image: {source}")
        chunk_type = data[position + 4 : position + 8]
        if chunk_type not in PNG_PRIVATE_CHUNKS:
            output.extend(data[position:chunk_end])
        position = chunk_end
        if chunk_type == b"IEND":
            saw_iend = True
            break
    if not saw_iend:
        fail(f"PNG image has no IEND chunk: {source}")
    destination.write_bytes(output)


def strip_jpeg_metadata(source: Path, destination: Path) -> None:
    data = source.read_bytes()
    if not data.startswith(b"\xff\xd8"):
        fail(f"invalid JPEG image: {source}")

    output = bytearray(data[:2])
    position = 2
    removable_markers = {0xE1, 0xED, 0xFE}  # EXIF/XMP, IPTC, comment.
    standalone_markers = set(range(0xD0, 0xDA)) | {0x01}
    while position < len(data):
        marker_start = position
        if data[position] != 0xFF:
            fail(f"invalid JPEG marker at byte {position}: {source}")
        while position < len(data) and data[position] == 0xFF:
            position += 1
        if position >= len(data):
            fail(f"truncated JPEG image: {source}")
        marker = data[position]
        position += 1

        if marker == 0xDA:  # Start of scan; copy compressed image data unchanged.
            output.extend(data[marker_start:])
            destination.write_bytes(output)
            return
        if marker == 0xD9:
            output.extend(data[marker_start:position])
            destination.write_bytes(output)
            return
        if marker in standalone_markers:
            output.extend(data[marker_start:position])
            continue
        if position + 2 > len(data):
            fail(f"truncated JPEG segment: {source}")
        segment_length = struct.unpack(">H", data[position : position + 2])[0]
        segment_end = position + segment_length
        if segment_length < 2 or segment_end > len(data):
            fail(f"invalid JPEG segment length: {source}")
        if marker not in removable_markers:
            output.extend(data[marker_start:segment_end])
        position = segment_end
    fail(f"JPEG image has no scan data: {source}")


def strip_webp_metadata(source: Path, destination: Path) -> None:
    data = source.read_bytes()
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        fail(f"invalid WebP image: {source}")

    output_chunks = bytearray()
    position = 12
    while position + 8 <= len(data):
        chunk_type = data[position : position + 4]
        chunk_length = struct.unpack("<I", data[position + 4 : position + 8])[0]
        payload_start = position + 8
        payload_end = payload_start + chunk_length
        padded_end = payload_end + (chunk_length % 2)
        if padded_end > len(data):
            fail(f"truncated WebP image: {source}")
        if chunk_type not in {b"EXIF", b"XMP "}:
            payload = bytearray(data[payload_start:payload_end])
            if chunk_type == b"VP8X" and payload:
                payload[0] &= ~0x0C  # Clear EXIF and XMP feature flags.
            output_chunks.extend(chunk_type)
            output_chunks.extend(struct.pack("<I", len(payload)))
            output_chunks.extend(payload)
            if len(payload) % 2:
                output_chunks.append(0)
        position = padded_end
    if position != len(data):
        fail(f"invalid WebP chunk boundary: {source}")

    riff_size = 4 + len(output_chunks)
    destination.write_bytes(b"RIFF" + struct.pack("<I", riff_size) + b"WEBP" + output_chunks)


def copy_image(source: Path, destination: Path, preserve_metadata: bool) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if preserve_metadata:
        shutil.copyfile(source, destination)
        return

    suffix = source.suffix.lower()
    if suffix == ".png":
        strip_png_metadata(source, destination)
    elif suffix in {".jpg", ".jpeg"}:
        strip_jpeg_metadata(source, destination)
    elif suffix == ".webp":
        strip_webp_metadata(source, destination)
    else:
        fail(f"cannot strip metadata from unsupported image type: {source}")


def copy_images(
    cuts: list[dict], output_dir: Path, basename: str, preserve_metadata: bool
) -> None:
    asset_dir = output_dir / f"{basename}_assets"
    asset_dir.mkdir(parents=True, exist_ok=True)

    width = max(2, len(str(max(cut["number"] for cut in cuts))))
    for cut in cuts:
        source = cut["_source_image"]
        suffix = source.suffix.lower() or ".png"
        destination = asset_dir / f"cut-{cut['number']:0{width}d}{suffix}"
        if source.resolve() != destination.resolve():
            copy_image(source, destination, preserve_metadata)
        cut["_image_src"] = destination.relative_to(output_dir).as_posix()


def render_caption(cut: dict, labels: dict) -> str:
    action_lines = [
        f"{labels['scene']}: {cut['scene']}",
        f"{labels['shot']}: {cut['shot']}",
        f"{labels['movement']}: {cut['action']}",
    ]
    if cut.get("vertical_crop"):
        action_lines.append(
            f"{labels['vertical_crop']}: {cut['vertical_crop']}"
        )
    action = "\n".join(action_lines)
    return f"""
    <div class="caption-grid">
      <div class="caption-block">
        <span class="caption-label">{escape(labels['action'])}</span>
        <div class="caption-text">{escape(action)}</div>
      </div>
      <div class="caption-block">
        <span class="caption-label">{escape(labels['dialogue'])}</span>
        <div class="caption-text">{escape(cut['dialogue'])}</div>
      </div>
      <div class="caption-block">
        <span class="caption-label">{escape(labels['sound'])}</span>
        <div class="caption-text">{escape(cut['sound'])}</div>
      </div>
    </div>"""


def render_row(cut: dict, labels: dict) -> str:
    return f"""
        <tr data-cut-number="{cut['number']}">
          <td class="cut-cell">{cut['number']}<span class="timecode">{escape(cut['start'])}<br>{escape(cut['end'])}</span></td>
          <td class="picture"><div class="picture-frame"><img src="{escape(cut['_image_src'])}" alt="{escape(labels['cut'])} {cut['number']} {escape(labels['picture'])}"></div></td>
          <td class="caption">{render_caption(cut, labels)}</td>
          <td class="duration">{escape(cut['duration'])}</td>
        </tr>"""


def render_page(
    page_cuts: list[dict], page_number: int, title: str, labels: dict
) -> str:
    rows = "".join(render_row(cut, labels) for cut in page_cuts)
    return f"""
  <section class="page" data-storyboard-page data-page-label="{escape(labels['page'])}">
    <div class="page-head"><div class="page-title">{escape(title)}</div><div class="page-no">{page_number} {escape(labels['page'])}</div></div>
    <table>
      <thead><tr><th class="cut-col">{escape(labels['cut'])}</th><th class="pic-col">{escape(labels['picture'])}</th><th class="cap-col">{escape(labels['description'])}</th><th class="dur-col">{escape(labels['duration'])}</th></tr></thead>
      <tbody>{rows}
      </tbody>
    </table>
  </section>"""


def render_framing_guide(cuts: list[dict], labels: dict) -> str:
    image_src = escape(cuts[0]["_image_src"])
    items = [
        ("frame", labels["guide_frame"]),
        ("safe", labels["guide_safe"]),
        ("sides", labels["guide_sides"]),
        ("subject", labels["guide_subject"]),
    ]
    legend = "".join(
        f'<div class="guide-item"><span class="guide-key guide-key-{kind}" aria-hidden="true"></span><span>{escape(text)}</span></div>'
        for kind, text in items
    )
    return f"""<section class="framing-guide" aria-label="{escape(labels['guide_title'])}">
      <h2>{escape(labels['guide_title'])}</h2>
      <div class="guide-grid">
        <div class="guide-frame"><img src="{image_src}" alt="{escape(labels['guide_title'])}"></div>
        <div class="guide-legend">{legend}</div>
      </div>
    </section>"""


def render_cover(data: dict, cuts: list[dict], labels: dict) -> str:
    if not data.get("include_cover", True):
        return ""

    lines = []
    format_name = data.get("format")
    estimated = data.get("estimated_duration")
    if format_name or estimated:
        value = str(format_name or "")
        if estimated:
            value += f", {len(cuts)}{labels['cut']}, {estimated}"
        lines.append(f"{labels['format']}: {value.strip(', ')}")

    cast = data.get("cast")
    if isinstance(cast, list) and cast:
        lines.append(f"{labels['cast']}: {', '.join(map(str, cast))}")

    notes = data.get("shooting_notes", [])
    if isinstance(notes, list):
        lines.extend(f"{labels['shooting']}: {note}" for note in notes)

    paragraphs = "".join(f"<p>{escape(line)}</p>" for line in lines)
    guide = (
        "\n    " + render_framing_guide(cuts, labels)
        if data.get("include_framing_guide", False)
        else ""
    )
    return f"""
  <section class="cover" data-storyboard-cover>
    <h1>{escape(data['title'])}</h1>
    {paragraphs}{guide}
  </section>"""


def render_html(
    data: dict, cuts: list[dict], labels: dict, cuts_per_page: int
) -> str:
    storyboard_pages = math.ceil(len(cuts) / cuts_per_page)
    total_pdf_pages = storyboard_pages + int(data.get("include_cover", True))
    pages = []
    for start in range(0, len(cuts), cuts_per_page):
        pages.append(
            render_page(
                cuts[start : start + cuts_per_page],
                len(pages) + 1,
                data["title"],
                labels,
            )
        )

    cover = render_cover(data, cuts, labels)
    lang = escape(data.get("html_lang", "en"))
    return f"""<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>{escape(data['title'])}</title>
  <style>
    * {{ box-sizing: border-box; }}
    @page {{ size: A4 portrait; margin: 9mm; }}
    body {{
      margin: 0;
      background: #e9e9e7;
      color: #111;
      font-family: "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
    }}
    main {{ max-width: 1120px; margin: 0 auto; padding: 28px 18px 56px; }}
    .cover {{ background: #fff; border: 1.5px solid #222; padding: 18px 22px; margin-bottom: 22px; }}
    h1 {{ margin: 0 0 10px; font-size: 28px; letter-spacing: 0; }}
    .cover p {{ margin: 5px 0; font-size: 14px; line-height: 1.55; }}
    .framing-guide {{ margin-top: 22px; padding-top: 16px; border-top: 1.5px solid #777; }}
    .framing-guide h2 {{ margin: 0 0 12px; font-size: 17px; letter-spacing: 0; }}
    .guide-grid {{ display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(190px, 1fr); gap: 16px; align-items: start; }}
    .guide-frame {{ width: 100%; aspect-ratio: 16 / 9; border: 4px solid #111; overflow: hidden; background: #fff; }}
    .guide-frame img {{ width: 100%; height: 100%; display: block; object-fit: contain; object-position: center; }}
    .guide-legend {{ display: grid; gap: 10px; font-size: 11px; line-height: 1.42; word-break: keep-all; }}
    .guide-item {{ display: grid; grid-template-columns: 28px 1fr; gap: 8px; align-items: start; }}
    .guide-key {{ width: 24px; height: 14px; margin-top: 2px; display: block; }}
    .guide-key-frame {{ border-top: 4px solid #111; }}
    .guide-key-safe {{ border-top: 3px dashed #72a9d2; }}
    .guide-key-sides {{ border: 1px solid #999; background: #e7e7e7; }}
    .guide-key-subject {{ border-left: 5px solid #111; border-right: 5px solid #111; }}
    .page {{ background: #fff; border: 1.5px solid #222; margin: 0 0 28px; break-after: page; }}
    .page-head {{ display: grid; grid-template-columns: 1fr auto; border-bottom: 1.5px solid #222; font-size: 13px; }}
    .page-head div {{ padding: 6px 8px; }}
    .page-title {{ font-weight: 700; }}
    .page-no {{ min-width: 76px; border-left: 1.5px solid #222; text-align: center; font-weight: 700; }}
    table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
    th, td {{ border-right: 1.5px solid #222; border-bottom: 1.5px solid #222; vertical-align: top; }}
    th:last-child, td:last-child {{ border-right: 0; }}
    tbody tr:last-child td {{ border-bottom: 0; }}
    th {{ padding: 6px; text-align: center; font-size: 15px; font-weight: 800; background: #fafafa; }}
    .cut-col {{ width: 6.5%; }}
    .pic-col {{ width: 39%; }}
    .cap-col {{ width: 47%; }}
    .dur-col {{ width: 7.5%; }}
    .cut-cell {{ padding: 8px 4px; text-align: center; font-size: 15px; font-weight: 800; }}
    .timecode {{ display: block; margin-top: 8px; font-size: 11px; font-weight: 500; line-height: 1.35; }}
    .picture {{ padding: 7px; background: #fff; vertical-align: middle; }}
    .picture-frame {{
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 3px solid #111;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #fff;
    }}
    .picture-frame img {{ width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; background: #fff; }}
    .caption {{ padding: 0; font-size: 11px; line-height: 1.42; }}
    .caption-grid {{ display: grid; grid-template-columns: 1.42fr 1fr 0.68fr; min-height: 214px; height: 100%; }}
    .caption-block {{ padding: 7px 8px; border-right: 1px solid #999; overflow-wrap: anywhere; }}
    .caption-block:last-child {{ border-right: 0; }}
    .caption-label {{ display: block; margin-bottom: 5px; font-size: 10px; font-weight: 800; }}
    .caption-text {{ white-space: pre-line; }}
    .duration {{ padding: 8px 3px; text-align: center; font-size: 12px; font-weight: 700; }}
    @media print {{
      html, body {{ background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }}
      main {{ max-width: none; padding: 0; }}
      .cover {{
        width: 192mm;
        max-width: 192mm;
        min-height: 279mm;
        margin: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        break-after: page;
        page-break-after: always;
      }}
      .framing-guide {{ margin-top: 16px; padding-top: 12px; }}
      .framing-guide h2 {{ margin-bottom: 9px; font-size: 14px; }}
      .guide-grid {{ grid-template-columns: minmax(0, 1.5fr) minmax(160px, 1fr); gap: 12px; }}
      .guide-legend {{ gap: 7px; font-size: 8.5px; line-height: 1.35; }}
      .guide-item {{ grid-template-columns: 24px 1fr; gap: 6px; }}
      .guide-key {{ width: 20px; height: 11px; }}
      .page {{
        width: 192mm;
        max-width: 192mm;
        margin: 0;
        border-width: 1px;
        break-inside: avoid;
        page-break-inside: avoid;
        break-after: page;
        page-break-after: always;
      }}
      .page:last-child {{ break-after: auto; page-break-after: auto; }}
      thead {{ display: table-header-group; }}
      tbody tr {{ break-inside: avoid; page-break-inside: avoid; }}
      .cut-col {{ width: 6%; }}
      .pic-col {{ width: 46%; }}
      .cap-col {{ width: 40%; }}
      .dur-col {{ width: 8%; }}
      .picture {{ padding: 5px; }}
      .caption {{ font-size: 8.5px; line-height: 1.3; }}
      .caption-grid {{ min-height: 0; grid-template-columns: 1.55fr 0.95fr 0.65fr; }}
      .caption-text {{ word-break: keep-all; overflow-wrap: normal; }}
      .caption-block {{ padding: 5px 6px; }}
      .caption-label {{ font-size: 8px; }}
      .cut-cell, th {{ font-size: 10px; }}
      .timecode, .duration {{ font-size: 8px; }}
    }}
    @media (max-width: 760px) {{
      main {{ padding: 14px 8px 36px; }}
      .guide-grid {{ grid-template-columns: 1fr; }}
      .page {{ overflow-x: auto; }}
      table {{ min-width: 1040px; }}
    }}
  </style>
</head>
<body>
<main data-storyboard-pages="{total_pdf_pages}">
{cover}{''.join(pages)}
</main>
</body>
</html>
"""


def render_markdown(data: dict, cuts: list[dict], labels: dict) -> str:
    lines = [f"# {markdown_inline(data['title'])}", ""]
    if data.get("format"):
        lines.extend([markdown_inline(data["format"]), ""])

    if data.get("include_framing_guide", False):
        lines.extend(
            [
                f"## {markdown_inline(labels['guide_title'])}",
                "",
                f"![{markdown_inline(labels['guide_title'])}]({cuts[0]['_image_src']})",
                "",
                f"- {markdown_inline(labels['guide_frame'])}",
                f"- {markdown_inline(labels['guide_safe'])}",
                f"- {markdown_inline(labels['guide_sides'])}",
                f"- {markdown_inline(labels['guide_subject'])}",
                "",
            ]
        )

    for cut in cuts:
        lines.extend(
            [
                f"## {markdown_inline(labels['cut'])} {cut['number']} - {markdown_inline(cut['start'])}-{markdown_inline(cut['end'])} - {markdown_inline(cut['duration'])}",
                "",
                f"![{markdown_inline(labels['cut'])} {cut['number']}]({cut['_image_src']})",
                "",
                f"| {markdown_cell(labels['description'])} | {markdown_cell(labels['action'])} |",
                "| --- | --- |",
                f"| {markdown_cell(labels['scene'])} | {markdown_cell(cut['scene'])} |",
                f"| {markdown_cell(labels['shot'])} | {markdown_cell(cut['shot'])} |",
                f"| {markdown_cell(labels['movement'])} | {markdown_cell(cut['action'])} |",
                f"| {markdown_cell(labels['vertical_crop'])} | {markdown_cell(cut.get('vertical_crop', ''))} |",
                f"| {markdown_cell(labels['dialogue'])} | {markdown_cell(cut['dialogue'])} |",
                f"| {markdown_cell(labels['sound'])} | {markdown_cell(cut['sound'])} |",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    manifest = args.manifest.expanduser().resolve()
    data = load_manifest(manifest)
    cuts = validate_manifest(data, manifest.parent)

    cuts_per_page = args.cuts_per_page or data.get("cuts_per_page", 4)
    if not isinstance(cuts_per_page, int) or cuts_per_page < 1:
        fail("cuts_per_page must be a positive integer")

    language = str(data.get("html_lang", "en")).lower().replace("_", "-")
    language = language.split("-", 1)[0]
    labels = dict(LABEL_SETS.get(language, ENGLISH_LABELS))
    custom_labels = data.get("labels", {})
    if custom_labels:
        if not isinstance(custom_labels, dict):
            fail("labels must be an object")
        unknown_labels = sorted(set(custom_labels) - set(labels))
        if unknown_labels:
            fail(f"unknown label keys: {', '.join(unknown_labels)}")
        labels.update({key: str(value) for key, value in custom_labels.items()})

    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    basename = validate_basename(args.basename or manifest.stem)
    copy_images(cuts, output_dir, basename, args.preserve_image_metadata)

    html_path = output_dir / f"{basename}.html"
    markdown_path = output_dir / f"{basename}.md"
    html_path.write_text(
        render_html(data, cuts, labels, cuts_per_page), encoding="utf-8"
    )
    markdown_path.write_text(
        render_markdown(data, cuts, labels), encoding="utf-8"
    )

    print(f"HTML: {html_path}")
    print(f"Markdown: {markdown_path}")
    print(f"Cuts: {len(cuts)}")
    print(
        "Expected PDF pages: "
        f"{math.ceil(len(cuts) / cuts_per_page) + int(data.get('include_cover', True))}"
    )


if __name__ == "__main__":
    main()
