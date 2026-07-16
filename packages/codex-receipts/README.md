# Codex Receipts

Receipt-style summaries for Codex work sessions.

[한국어 README](./README.ko.md)

[![npm version](https://img.shields.io/npm/v/codex-receipts)](https://www.npmjs.com/package/codex-receipts)
[![skills.sh installs](https://skills.sh/b/iamxoghks/skills/codex-receipts)](https://skills.sh/iamxoghks/skills/codex-receipts)

This fork turns the original [`claude-receipts`](https://github.com/chrishutchinson/claude-receipts) idea into a Codex-native toy: it reads local Codex session logs, counts the visible work trail, and prints a tiny "proof of work" receipt for the latest session.

## What It Prints

- session id, location, and timestamp
- counts of user prompts and assistant replies
- counts of tool calls, tool outputs, and reasoning items
- token usage when Codex recorded it in the session log
- a made-up `pts` total instead of billing cost

The receipt does not reproduce prompt or reply bodies. The points are
intentionally playful and are not API billing numbers.

## Install As A Codex Skill

Enter this command in a Codex conversation:

```text
$skill-installer install https://github.com/iamxoghks/skills/tree/main/skills/codex-receipts
```

Or install it globally for Codex with the Agent Skills CLI:

```bash
npx skills add iamxoghks/skills \
  --skill codex-receipts \
  --global \
  --agent codex \
  --yes
```

Restart Codex after installation, then invoke it with `$codex-receipts`.

The skill does not download packages at runtime. Install its matching CLI
version once before invoking the skill:

```bash
npm install --global codex-receipts@1.2.10
```

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
npm test
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

Generate a localized receipt:

```bash
npx codex-receipts generate --output html --locale ko
npx codex-receipts generate --output html --locale ja
npx codex-receipts generate --output html --locale zh
```

Override receipt text:

```bash
npx codex-receipts generate \
  --cashier-label "Operator" \
  --cashier "Codex Bot" \
  --footer-message "Printed on purpose."
```

Generate console output:

```bash
npx codex-receipts generate --output console
```

Print to a thermal receipt printer:

```bash
npx codex-receipts generate --output printer --printer usb
```

USB mode looks for the default Epson TM-T88V device (`04b8:0202`). If your
printer appears in the visible USB device list with a different id, pass it
explicitly:

```bash
npx codex-receipts generate --output printer --printer usb:VID:PID
```

Network and CUPS printers are also supported:

```bash
npx codex-receipts generate --output printer --printer tcp://HOST:9100
npx codex-receipts generate --output printer --printer CUPS_PRINTER_NAME
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

The MCP server is a local stdio server. It does not open an HTTP port; MCP
clients start it as a local process and communicate over stdin/stdout.

The MCP server exposes:

- `list_codex_sessions`: list recent local Codex sessions from `~/.codex`
- `generate_codex_receipt`: generate a text receipt and optionally save HTML
  under `~/.codex-receipts/projects`

`generate_codex_receipt` also accepts an optional `printer` value (`usb`,
`usb:VID:PID`, `tcp://HOST:9100`, or a CUPS printer name). When `printer` is
set, MCP saves the HTML receipt before trying printer output. If the printer is
not connected or cannot be found, the tool returns printer troubleshooting
guidance and the saved `htmlPath` instead of failing the whole receipt request.
It also accepts `location`, `locale` (`en`, `ko`, `ja`, or `zh`),
`cashierLabel`, `cashier`, and `footerMessage`. If `cashier` is omitted, the
receipt uses the model name recorded in the Codex session. Location defaults to
config or `The Cloud`; no public-IP or geolocation lookup is performed.

Printer output is a local side effect. Only enable the MCP `printer` option in
trusted local MCP clients, and only pass `tcp://HOST:9100` values for printers
you trust. The TCP mode opens a local outbound socket to the host and port you
provide; it is intended for network receipt printers, not for remote API access.

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

Use this config in any MCP client that accepts stdio server definitions. For
example, add the `codex-receipts` server entry to the client's MCP server
configuration, then ask the client to list sessions or generate a receipt.

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
npx codex-receipts config --set locale=ko
npx codex-receipts config --set cashierLabel="담당"
npx codex-receipts config --set cashier="Codex Bot"
npx codex-receipts config --set footerMessage="오늘도 수고했음"
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

## Security Notes

- The CLI and MCP server read local Codex logs from `~/.codex` and write receipts
  under `~/.codex-receipts`.
- Receipt language can be set per run with `--locale en|ko|ja|zh` or in config
  with `locale=en|ko|ja|zh`.
- Cashier label, cashier value, and footer message can be overridden per run or
  saved in config. If `cashier` is not set, Codex Receipts uses the model name
  recorded in the session log.
- Location defaults to `The Cloud`; the package does not call public-IP or
  geolocation services.
- Shell commands are executed with argument arrays, not interpolated shell
  strings.
- HTML receipts escape local log-derived text before rendering.
- Printer output can talk to USB devices, CUPS, or a user-supplied TCP printer
  endpoint. Treat MCP printer access as trusted-local only.

## Outputs

- `console`: boxed terminal receipt
- `html`: saves to `~/.codex-receipts/projects/[session-id].html`
- `printer`: sends ESC/POS output to USB, TCP, or CUPS receipt printers

Korean labels work for console and HTML output. Thermal-printer Korean output
depends on the printer firmware/codepage support for UTF-8 or Korean text.
When a non-English locale is used with `--output printer`, the CLI and MCP result
show a reminder about UTF-8 or target-language codepage support before or
alongside printer output.

## Codex Skill

The companion Codex skill is maintained in the public
[`iamxoghks/skills`](https://github.com/iamxoghks/skills/tree/main/skills/codex-receipts)
catalog. This repository remains the source for the npm CLI and MCP server.

## Release

This package uses npm trusted publishing from GitHub Actions. To publish a new
version, bump the package version and push the generated tag:

```bash
npm version patch
git push origin main --tags
```

The `Publish to npm` workflow runs only for tags matching `v*`, runs `npm test`,
and publishes the package to npm. Use `minor` or `major` instead of `patch` when
the release scope requires it. After publishing a new CLI version, update the
pinned version in the catalog skill separately.

## Notes

This is intentionally a fun utility, not an accounting tool. Codex currently exposes local session activity logs, so this project measures the work trail rather than exact model spend.
