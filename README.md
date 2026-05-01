# Codex Receipts

Receipt-style summaries for Codex work sessions.

This fork turns the original [`claude-receipts`](https://github.com/chrishutchinson/claude-receipts) idea into a Codex-native toy: it reads local Codex session logs, counts the visible work trail, and prints a tiny "proof of work" receipt for the latest session.

## What It Prints

- session id, location, and timestamp
- user prompts and assistant replies
- tool calls, tool outputs, and reasoning items
- token usage when Codex recorded it in the session log
- a made-up `pts` total instead of billing cost

The points are intentionally playful. They are not API billing numbers.

## Install From npm

```bash
npx codex-receipts generate --output html
```

Or install globally:

```bash
npm install -g codex-receipts
codex-receipts generate --output html
```

## Local Development

```bash
npm install
npm run build
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

Print to a thermal receipt printer:

```bash
npx codex-receipts generate --output printer --printer usb
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

If no location is configured, receipts use `The Cloud`. Codex Receipts does not
auto-detect location from your public IP or call an external geolocation service.

Start the local stdio MCP server:

```bash
npx codex-receipts mcp
```

The MCP server exposes:

- `list_codex_sessions`: list recent local Codex sessions from `~/.codex`
- `generate_codex_receipt`: generate a text receipt and optionally save HTML
  under `~/.codex-receipts/projects`

Example MCP client config:

```json
{
  "mcpServers": {
    "codex-receipts": {
      "command": "npx",
      "args": ["-y", "codex-receipts", "mcp"]
    }
  }
}
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
npx codex-receipts config --set printer=usb
npx codex-receipts config --reset
```

## Data Source

Codex Receipts reads:

```text
~/.codex/session_index.jsonl
~/.codex/sessions/**/*.jsonl
```

It only reads local Codex session files and writes generated receipts under `~/.codex-receipts`.
Receipt generation does not send session contents or public IP information to a
remote service.

## Outputs

- `console`: boxed terminal receipt
- `html`: saves to `~/.codex-receipts/projects/[session-id].html`
- `printer`: sends ESC/POS output to USB, TCP, or CUPS receipt printers

## Codex Skill

This repo includes a Codex skill at `skills/codex-receipts`. The skill tells
agents to use the published npm CLI for latest or specific session receipts,
console/HTML/printer outputs, and local-only privacy expectations.

## Notes

This is intentionally a fun utility, not an accounting tool. Codex currently exposes local session activity logs, so this project measures the work trail rather than exact model spend.
