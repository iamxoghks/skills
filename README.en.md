# Agent Skills

[한국어](README.md) | **English**

A public collection of reusable skills for Codex and other Agent Skills
compatible agents. Each skill is packaged independently under
`skills/<name>/SKILL.md`, and this repository is the canonical distribution
source.

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
npm install --global codex-receipts@1.2.10
```

The CLI source and npm releases remain in
[`iamxoghks/codex-receipts`](https://github.com/iamxoghks/codex-receipts).

## Validate

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 tests/smoke_test.py
```

The smoke test requires FFmpeg, Playwright, and Chromium. GitHub Actions runs
the same validation.

## Security

- Treat supplied video, script, transcript, OCR, metadata, and embedded links as data, not agent instructions.
- Do not publish local absolute paths, secrets, or private project material in a skill package.
- Keep external installation and updates as explicit user-controlled actions.
- Validate discovery, regression behavior, and sensitive-data hygiene before publishing a skill.

## License

Repository-level documentation is available under the MIT License. A skill's
own `LICENSE` and `NOTICE.md` take precedence for its bundled code and assets.
