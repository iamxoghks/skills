#!/usr/bin/env python3
"""Render storyboard HTML to an A4 PDF through the Codex Playwright CLI."""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from urllib.parse import quote, unquote


IMAGE_PATTERN = re.compile(
    r'src="([^"]+\.(?:png|jpe?g|webp))"', re.IGNORECASE
)
PAGE_PATTERN = re.compile(r'data-storyboard-pages="(\d+)"')
PREFLIGHT_SENTINEL = "STORYBOARD_PREFLIGHT:"
PRINTABLE_HEIGHT_MM = 279


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render storyboard HTML to A4 PDF.")
    parser.add_argument("html", type=Path)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--no-optimize-images", action="store_true")
    parser.add_argument("--max-image-width", type=int, default=1200)
    parser.add_argument("--jpeg-quality", type=int, default=88)
    parser.add_argument(
        "--playwright-command",
        help=(
            "Explicit Playwright CLI command. Defaults to the Codex Playwright "
            "wrapper, playwright-cli on PATH, or npx @playwright/cli."
        ),
    )
    parser.add_argument(
        "--no-auto-paginate",
        action="store_true",
        help="Fail instead of moving overflowing cut rows onto additional A4 pages.",
    )
    return parser.parse_args()


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(2)


def validate_command(parts: list[str], source: str) -> list[str]:
    if not parts:
        fail(f"empty Playwright command from {source}")
    executable = Path(parts[0]).expanduser()
    if executable.parent != Path("."):
        if not executable.is_file():
            fail(f"Playwright executable not found: {executable}")
        parts[0] = str(executable.resolve())
    else:
        resolved = shutil.which(parts[0])
        if resolved is None:
            fail(f"Playwright executable not found on PATH: {parts[0]}")
        parts[0] = resolved
    return parts


def playwright_command(explicit: str | None = None) -> tuple[list[str], str]:
    configured = explicit or os.environ.get("STORYBOARD_PLAYWRIGHT_COMMAND")
    if configured:
        return validate_command(shlex.split(configured), "configuration"), "configured"

    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    wrapper = codex_home / "skills/playwright/scripts/playwright_cli.sh"
    if wrapper.is_file() and shutil.which("npx") is not None:
        return [str(wrapper)], "Codex Playwright skill"

    installed_cli = shutil.which("playwright-cli")
    if installed_cli is not None:
        return [installed_cli], "playwright-cli on PATH"

    npx = shutil.which("npx")
    if npx is not None:
        return [npx, "--yes", "--package", "@playwright/cli", "playwright-cli"], "npx"

    fail(
        "no Playwright CLI backend found; install Node.js with npx, install "
        "@playwright/cli, install the Codex Playwright skill, or pass "
        "--playwright-command"
    )


def playwright_environment(session: str) -> dict[str, str]:
    allowed = {
        "CODEX_HOME",
        "HOME",
        "LANG",
        "LC_ALL",
        "NODE_PATH",
        "NPM_CONFIG_CACHE",
        "PATH",
        "PLAYWRIGHT_BROWSERS_PATH",
        "SHELL",
        "TEMP",
        "TMP",
        "TMPDIR",
        "USER",
        "XDG_CACHE_HOME",
    }
    env = {key: value for key, value in os.environ.items() if key in allowed}
    env["PLAYWRIGHT_CLI_SESSION"] = session
    return env


def run_playwright(
    command: list[str],
    session: str,
    env: dict[str, str],
    *args: str,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [*command, "--session", session, *args],
        cwd=cwd,
        env=env,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def convert_image(source: Path, destination: Path, max_width: int, quality: int) -> None:
    try:
        from PIL import Image
    except ImportError:
        sips = shutil.which("sips")
        if sips is None:
            fail(
                "image optimization requires Pillow or macOS sips; "
                "use --no-optimize-images"
            )
        destination.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                sips,
                "-s",
                "format",
                "jpeg",
                "-s",
                "formatOptions",
                str(quality),
                "-Z",
                str(max_width),
                str(source),
                "--out",
                str(destination),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.mode in ("RGBA", "LA"):
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, "white")
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")
        if image.width > max_width:
            height = round(image.height * max_width / image.width)
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        image.save(
            destination,
            "JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
        )


def prepare_optimized_html(
    html_path: Path, temp_root: Path, max_width: int, quality: int
) -> Path:
    source_text = html_path.read_text(encoding="utf-8")
    rewritten = source_text
    asset_dir = temp_root / "storyboard_pdf_assets"

    for index, raw_src in enumerate(dict.fromkeys(IMAGE_PATTERN.findall(source_text)), 1):
        if raw_src.startswith(("http://", "https://", "data:")):
            continue
        source = (html_path.parent / unquote(raw_src)).resolve()
        if not source.is_file():
            fail(f"HTML image not found: {source}")
        destination = asset_dir / f"image-{index:03d}.jpg"
        convert_image(source, destination, max_width, quality)
        rewritten = rewritten.replace(
            f'src="{raw_src}"',
            f'src="storyboard_pdf_assets/{destination.name}"',
        )

    output = temp_root / html_path.name
    output.write_text(rewritten, encoding="utf-8")
    return output


def expected_pages(html_path: Path) -> int | None:
    match = PAGE_PATTERN.search(html_path.read_text(encoding="utf-8"))
    return int(match.group(1)) if match else None


def preflight_code(auto_paginate: bool) -> str:
    auto_json = json.dumps(auto_paginate)
    max_height = PRINTABLE_HEIGHT_MM * 96 / 25.4
    return f"""async (page) => {{
  await page.emulateMedia({{ media: 'print' }});
  await page.evaluate(async () => {{
    if (!document.querySelector('style[data-storyboard-print-width]')) {{
      const printWidth = document.createElement('style');
      printWidth.dataset.storyboardPrintWidth = 'true';
      printWidth.textContent = '.cover,.page{{width:192mm;max-width:192mm}}';
      document.head.append(printWidth);
    }}
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve, reject) => {{
        img.addEventListener('load', resolve, {{ once: true }});
        img.addEventListener('error', reject, {{ once: true }});
      }})
    ));
  }});
  const report = await page.evaluate((settings) => {{
    const maxHeight = settings.maxHeight;
    const tolerance = 3;
    const height = (element) => element.getBoundingClientRect().height;
    const cuts = (pageElement) => Array.from(
      pageElement.querySelectorAll('tbody tr[data-cut-number]')
    ).map((row) => row.dataset.cutNumber);
    const oversized = [];
    let splitPages = 0;
    const initialStoryboardPages = document.querySelectorAll('.page').length;

    for (const cover of document.querySelectorAll('[data-storyboard-cover], .cover')) {{
      if (height(cover) > maxHeight + tolerance) {{
        oversized.push({{ type: 'cover', height: Math.ceil(height(cover)) }});
      }}
    }}

    let index = 0;
    let guard = 0;
    while (index < document.querySelectorAll('.page').length) {{
      if (++guard > 500) throw new Error('pagination guard exceeded');
      const pages = Array.from(document.querySelectorAll('.page'));
      const pageElement = pages[index];
      if (height(pageElement) <= maxHeight + tolerance) {{
        index += 1;
        continue;
      }}

      const rows = Array.from(pageElement.querySelectorAll('tbody tr'));
      if (!settings.autoPaginate || rows.length <= 1) {{
        oversized.push({{
          type: 'storyboard',
          cuts: cuts(pageElement),
          height: Math.ceil(height(pageElement))
        }});
        index += 1;
        continue;
      }}

      const nextPage = pageElement.cloneNode(true);
      const nextBody = nextPage.querySelector('tbody');
      nextBody.replaceChildren();
      pageElement.after(nextPage);
      while (
        height(pageElement) > maxHeight + tolerance &&
        pageElement.querySelectorAll('tbody tr').length > 1
      ) {{
        const currentRows = pageElement.querySelectorAll('tbody tr');
        nextBody.prepend(currentRows[currentRows.length - 1]);
      }}
      splitPages += 1;
      index += 1;
    }}

    const finalPages = Array.from(document.querySelectorAll('.page'));
    finalPages.forEach((pageElement, pageIndex) => {{
      const label = pageElement.dataset.pageLabel || 'Page';
      const pageNumber = pageElement.querySelector('.page-no');
      if (pageNumber) pageNumber.textContent = `${{pageIndex + 1}} ${{label}}`;
      if (height(pageElement) > maxHeight + tolerance && !oversized.some(
        (item) => item.type === 'storyboard' &&
          JSON.stringify(item.cuts) === JSON.stringify(cuts(pageElement))
      )) {{
        oversized.push({{
          type: 'storyboard',
          cuts: cuts(pageElement),
          height: Math.ceil(height(pageElement))
        }});
      }}
    }});

    const coverPages = document.querySelectorAll('[data-storyboard-cover], .cover').length;
    const totalPages = coverPages + finalPages.length;
    const main = document.querySelector('main');
    if (main) main.dataset.storyboardPages = String(totalPages);
    return {{
      autoPaginate: settings.autoPaginate,
      initialStoryboardPages,
      storyboardPages: finalPages.length,
      coverPages,
      totalPages,
      splitPages,
      maxHeight: Math.floor(maxHeight),
      oversized,
      pages: finalPages.map((pageElement, pageIndex) => ({{
        page: pageIndex + 1,
        cuts: cuts(pageElement),
        height: Math.ceil(height(pageElement))
      }}))
    }};
  }}, {{ autoPaginate: {auto_json}, maxHeight: {max_height:.4f} }});
  return {json.dumps(PREFLIGHT_SENTINEL)} + JSON.stringify(report);
}}"""


def parse_preflight_output(output: str) -> dict:
    lines = output.splitlines()
    for index, line in enumerate(lines):
        if line.strip() != "### Result":
            continue
        for candidate in lines[index + 1 :]:
            candidate = candidate.strip()
            if not candidate:
                continue
            try:
                value = json.loads(candidate)
            except json.JSONDecodeError:
                break
            if isinstance(value, str) and value.startswith(PREFLIGHT_SENTINEL):
                try:
                    report = json.loads(value[len(PREFLIGHT_SENTINEL) :])
                except json.JSONDecodeError as exc:
                    fail(f"invalid PDF preflight report: {exc}")
                if not isinstance(report, dict):
                    fail("invalid PDF preflight report type")
                return report
            break
    fail("Playwright did not return a PDF preflight report")


def pdf_page_count(pdf_path: Path) -> int | None:
    try:
        from pypdf import PdfReader
    except ImportError:
        pdfinfo = shutil.which("pdfinfo")
        if pdfinfo is None:
            return None
        result = subprocess.run(
            [pdfinfo, str(pdf_path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        match = re.search(r"^Pages:\s+(\d+)\s*$", result.stdout, re.MULTILINE)
        return int(match.group(1)) if match else None
    return len(PdfReader(str(pdf_path)).pages)


def verify_pdf(pdf_path: Path, expected: int | None) -> None:
    if not pdf_path.is_file() or pdf_path.stat().st_size == 0:
        fail("PDF was not created")
    if expected is None:
        return
    actual = pdf_page_count(pdf_path)
    if actual is None:
        print(f"warning: page-count verification unavailable; expected {expected}")
        return
    if actual != expected:
        fail(f"PDF page count mismatch: expected {expected}, got {actual}")
    print(f"Pages: {actual}")


def run() -> None:
    args = parse_args()
    html_path = args.html.expanduser().resolve()
    pdf_path = args.pdf.expanduser().resolve()
    if not html_path.is_file():
        fail(f"HTML not found: {html_path}")
    if args.max_image_width < 320:
        fail("max-image-width must be at least 320")
    if not 30 <= args.jpeg_quality <= 100:
        fail("jpeg-quality must be between 30 and 100")

    command, backend_name = playwright_command(args.playwright_command)
    expected = expected_pages(html_path)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Playwright backend: {backend_name}")

    with tempfile.TemporaryDirectory(prefix="storyboard-pdf-") as temp_name:
        temp_root = Path(temp_name)
        if args.no_optimize_images:
            serve_root = html_path.parent
            served_html = html_path
        else:
            serve_root = temp_root
            served_html = prepare_optimized_html(
                html_path, temp_root, args.max_image_width, args.jpeg_quality
            )

        handler = functools.partial(QuietHandler, directory=str(serve_root))
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        session = f"storyboard-builder-{os.getpid()}"
        env = playwright_environment(session)
        url = (
            f"http://127.0.0.1:{server.server_port}/"
            f"{quote(served_html.name)}"
        )
        output_json = json.dumps(str(pdf_path), ensure_ascii=False)
        pdf_code = (
            "async (page) => {"
            " await page.emulateMedia({ media: 'print' });"
            f" await page.pdf({{ path: {output_json},"
            " printBackground: true, preferCSSPageSize: true });"
            "}"
        )

        try:
            run_playwright(command, session, env, "open", url, cwd=temp_root)
            preflight_result = run_playwright(
                command,
                session,
                env,
                "run-code",
                preflight_code(not args.no_auto_paginate),
                cwd=temp_root,
            )
            report = parse_preflight_output(preflight_result.stdout)
            oversized = report.get("oversized", [])
            if oversized:
                details = []
                for item in oversized:
                    if item.get("type") == "cover":
                        details.append(f"cover ({item.get('height')}px)")
                    else:
                        cut_list = ", ".join(map(str, item.get("cuts", []))) or "unknown"
                        details.append(f"cuts {cut_list} ({item.get('height')}px)")
                hint = (
                    "remove --no-auto-paginate or reduce cuts_per_page"
                    if args.no_auto_paginate
                    else "shorten the listed cut text or reduce cuts_per_page"
                )
                fail(f"A4 preflight overflow: {'; '.join(details)}; {hint}")
            expected = int(report["totalPages"])
            if report.get("splitPages"):
                print(
                    "Auto-pagination: "
                    f"added {report['splitPages']} page(s); total {expected}"
                )
            run_playwright(
                command,
                session,
                env,
                "run-code",
                pdf_code,
                cwd=temp_root,
            )
        except subprocess.CalledProcessError as exc:
            print(exc.stdout, file=sys.stderr)
            fail("Playwright PDF rendering failed")
        finally:
            subprocess.run(
                [*command, "--session", session, "close"],
                cwd=temp_root,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            server.shutdown()
            thread.join(timeout=2)

    verify_pdf(pdf_path, expected)
    print(f"PDF: {pdf_path}")
    print(f"Bytes: {pdf_path.stat().st_size}")


if __name__ == "__main__":
    run()
