# Codex Receipts Project Notes

This repo is a Codex-oriented fork of the original receipt generator.

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

## Important Behavior

Codex Receipts does not calculate real spend. It generates playful `pts` from prompts, assistant replies, tool calls, tool outputs, reasoning items, and token usage if Codex logged it.

Do not reintroduce external usage CLIs, non-Codex hook behavior, or writes outside Codex Receipts config/output paths. This fork should stay Codex-native.
