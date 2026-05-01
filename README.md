# Codex Receipts

Thermal-printer-style receipts for Codex work sessions.

This fork turns the original [`claude-receipts`](https://github.com/chrishutchinson/claude-receipts) idea into a Codex-native toy: it reads local Codex session logs, counts the visible work trail, and prints a tiny "proof of work" receipt for the latest session.

## What It Prints

- session id, location, and timestamp
- user prompts and assistant replies
- tool calls, tool outputs, and reasoning items
- token usage when Codex recorded it in the session log
- a made-up `pts` total instead of billing cost

The points are intentionally playful. They are not API billing numbers.

## Install

```bash
npm install
npm run build
```

For local testing:

```bash
node bin/codex-receipts.js generate
```

## Commands

Generate a receipt for the most recent Codex session:

```bash
npx codex-receipts generate
```

Generate HTML:

```bash
npx codex-receipts generate --output html
```

Generate console output:

```bash
npx codex-receipts generate --output console
```

Generate for a specific session id, id prefix, or thread-name fragment:

```bash
npx codex-receipts generate --session 019de4e1
npx codex-receipts generate --session "Codex용 프로젝트"
```

Override location:

```bash
npx codex-receipts generate --location "Cheonan, KR"
```

## Configuration

Configuration is stored at:

```text
~/.codex-receipts.config.json
```

Run:

```bash
npx codex-receipts setup
npx codex-receipts config --show
npx codex-receipts config --set timezone="Asia/Seoul"
npx codex-receipts config --reset
```

## Data Source

Codex Receipts reads:

```text
~/.codex/session_index.jsonl
~/.codex/sessions/**/*.jsonl
```

It does not use `ccusage`, and it does not touch `~/.claude`.

## Outputs

- `console`: boxed terminal receipt
- `html`: saves to `~/.codex-receipts/projects/[session-id].html`
- `printer`: keeps the original thermal-printer path, now fed by Codex work data

## Notes

This is intentionally a fun utility, not an accounting tool. Codex currently exposes local session activity logs, so this project measures the work trail rather than exact model spend.
