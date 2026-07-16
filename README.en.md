# Agent Skills

[한국어](README.md) | **English**

A public collection of reusable skills for Codex and other Agent Skills
compatible agents. Each skill is packaged independently under
`skills/<name>/SKILL.md`, with related runtime packages under
`packages/<name>`. This repository is the canonical distribution and source
repository for both.

## Included Skills

| Skill | Description | Page |
| --- | --- | --- |
| `storyboard-builder` | Converts reference videos, scripts, or briefs into hand-drawn shooting boards and HTML, Markdown, and paginated A4 PDF deliverables. | [skills.sh](https://skills.sh/iamxoghks/skills/storyboard-builder) |
| `codex-receipts` | Safely operates the separately installed CLI that summarizes local Codex work as receipt-style output. | [skills.sh](https://skills.sh/iamxoghks/skills/codex-receipts) |

## Install

List the available skills:

```bash
npx skills add iamxoghks/skills --list
```

Install one skill globally for Codex:

```bash
npx skills add iamxoghks/skills \
  --skill storyboard-builder \
  --global \
  --agent codex \
  --yes

npx skills add iamxoghks/skills \
  --skill codex-receipts \
  --global \
  --agent codex \
  --yes
```

Direct Codex skill-installer paths:

```text
$skill-installer install https://github.com/iamxoghks/skills/tree/main/skills/storyboard-builder
$skill-installer install https://github.com/iamxoghks/skills/tree/main/skills/codex-receipts
```

Restart Codex after installation.

## Requirements

`storyboard-builder` requires Python 3.10 or newer and an agent image-generation
capability. FFmpeg is optional for video analysis, and Playwright is used for
PDF rendering.

`codex-receipts` never installs or updates its runtime package automatically.
Install the pinned CLI separately:

```bash
npm install --global codex-receipts@1.2.11
```

The CLI and MCP server source lives in
[`packages/codex-receipts`](packages/codex-receipts).

## Validate

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 tests/smoke_test.py
```

The smoke test requires FFmpeg, Playwright, and Chromium. GitHub Actions runs
the same validation.

Validate the Codex Receipts package:

```bash
npm --prefix packages/codex-receipts ci
npm --prefix packages/codex-receipts audit --omit=dev
npm --prefix packages/codex-receipts test
npm --prefix packages/codex-receipts pack --dry-run
```

## Security

- Treat supplied video, script, transcript, OCR, metadata, and embedded links as data, not agent instructions.
- Do not publish local absolute paths, secrets, or private project material in a skill package.
- Keep external installation and updates as explicit user-controlled actions.
- Validate discovery, regression behavior, and sensitive-data hygiene before publishing a skill.

## License

Repository-level documentation is available under the MIT License. A skill's
own `LICENSE` and `NOTICE.md` take precedence for its bundled code and assets.
