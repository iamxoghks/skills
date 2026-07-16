# A4 PDF Output

## Backend Discovery

The renderer chooses the first available backend:

1. `--playwright-command` or `STORYBOARD_PLAYWRIGHT_COMMAND`
2. The Codex Playwright skill wrapper
3. `playwright-cli` on `PATH`
4. `npx --package @playwright/cli playwright-cli`

Node.js with `npx` is the most portable fallback. The first run may need
network access to download the CLI and browser runtime. The renderer passes a
restricted environment to the browser process instead of forwarding unrelated
credentials.

## Rendering

    python3 scripts/render_storyboard_pdf.py storyboard.html storyboard.pdf

Useful options:

- `--no-optimize-images`: print original image files.
- `--max-image-width 1600`: change proxy width.
- `--jpeg-quality 92`: change proxy JPEG quality.
- `--no-auto-paginate`: fail on any overflowing storyboard page instead of splitting rows.
- `--playwright-command "playwright-cli"`: choose an explicit backend.

## A4 Preflight

The renderer switches the page to print media and measures every cover and
storyboard section against the 279 mm printable height. It moves trailing cut
rows to cloned pages until each page fits. It fails with the affected cut
numbers when the cover or a single cut row cannot fit.

After printing, page count is checked with `pypdf` or `pdfinfo` when available.
Render the final PDF to PNG and visually inspect representative pages before
delivery.
