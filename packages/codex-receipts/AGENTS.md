# Codex Receipts Package Notes

This directory contains the npm CLI and MCP server for the Codex Receipts skill.
The repository root contains the public skill catalog and shared CI.

## Commands

```bash
npm install
npm run build
node bin/codex-receipts.js generate --output console
node bin/codex-receipts.js generate --output html
```

## Current Design

- `src/core/data-fetcher.ts` reads `~/.codex/session_index.jsonl` and `~/.codex/sessions/**/*.jsonl`.
- `src/core/transcript-parser.ts` extracts session id, prompt, timestamps, and message counts from Codex JSONL logs.
- `src/core/receipt-generator.ts` renders console receipt text.
- `src/core/html-renderer.ts` renders standalone HTML receipts into `~/.codex-receipts/projects`.
- `src/core/thermal-printer.ts` renders ESC/POS output for physical receipt printers.

## Important Behavior

Codex Receipts does not calculate real spend. It generates playful `pts` from prompts, assistant replies, tool calls, tool outputs, reasoning items, and token usage if Codex logged it.

Do not reintroduce external usage CLIs, non-Codex hook behavior, or writes outside Codex Receipts config/output paths. This fork should stay Codex-native.

## Skill Integration

The public agent skill is maintained at `../../skills/codex-receipts`. Do not
add a discoverable `SKILL.md` to this package directory. After publishing a new
package version, update the pinned CLI version in the catalog skill and run all
root-level catalog and package validation before announcing the release.

## Release

Publish only through the root workflow
`.github/workflows/publish-codex-receipts.yml`. Release tags use
`codex-receipts-v<version>` and must match this package's version.
