---
name: "codex-receipts"
description: "Use when the user asks for a receipt-style summary of Codex work, wants the latest or a specific session receipt, needs console/html/printer output, or asks how to share a local Codex session summary without sending session logs to a remote service."
---

# Codex Receipts

Generate receipt-style summaries from local Codex session logs using the published npm CLI.

## When to Use

- The user asks for a Codex receipt, session receipt, proof-of-work receipt, or work summary.
- The user wants the latest Codex session summarized.
- The user provides a specific session id, id prefix, or thread-name fragment.
- The user asks for console, HTML, or thermal-printer receipt output.
- The user asks for an English, Korean, Japanese, or Chinese receipt.
- The user asks to set receipt location, language, cashier text, footer text, or printer output.
- The user asks whether receipt generation is local/private.

## Required Tool

Use the already-installed published CLI. This skill release expects
`codex-receipts` version `1.2.10`.

Before running a receipt command, verify the executable and version:

```bash
command -v codex-receipts >/dev/null 2>&1
codex-receipts --version
```

If the executable is missing or the version differs, stop and tell the user
that `codex-receipts@1.2.10` must be installed separately. Do not download,
install, or update the CLI automatically. Wait until the user confirms the
required version is installed before continuing.

Do not reimplement receipt parsing in the agent. Prefer the CLI so output behavior stays aligned with the package.

When the MCP server is configured, you can also use its tools:

- `list_codex_sessions`
- `generate_codex_receipt`

For MCP printer output, pass `printer` as `usb`, `usb:VID:PID`, `tcp://HOST:9100`, or a CUPS printer name. MCP saves HTML before attempting printer output and returns printer troubleshooting guidance if printing fails.

For localized receipts, pass `--locale ko`, `--locale ja`, or `--locale zh` in the CLI, or pass `locale: "ko"`, `locale: "ja"`, or `locale: "zh"` to the MCP tool.
If non-English printer output is requested, tell the user the printer or driver must support UTF-8 or the target language code page; otherwise text may print garbled and HTML output is the safer fallback.
Use `--cashier-label`, `--cashier`, and `--footer-message` when the user asks to customize the receipt copy. If `--cashier` is omitted, the package uses the model name from the Codex session automatically.

## Configurable Fields

Per run, the CLI and MCP support:

- `location`: printed location. Defaults to config or `The Cloud`; no public-IP or geolocation lookup is used.
- `locale`: `en`, `ko`, `ja`, or `zh`.
- `cashierLabel`: label before the cashier/model value.
- `cashier`: value after the cashier label. Defaults to the model name recorded in the Codex session.
- `footerMessage`: final receipt message. Defaults to the locale footer.
- `printer`: physical printer target; only use when the user asks for printer output.

Persistent CLI config supports:

```bash
codex-receipts config --set location="Cheonan, KR"
codex-receipts config --set timezone="Asia/Seoul"
codex-receipts config --set locale=ko
codex-receipts config --set cashierLabel="담당"
codex-receipts config --set cashier="Codex Bot"
codex-receipts config --set footerMessage="오늘도 수고했음"
codex-receipts config --set printer=usb
```

## Common Commands

Latest session, default output:

```bash
codex-receipts generate
```

Console output:

```bash
codex-receipts generate --output console
```

HTML output:

```bash
codex-receipts generate --output html
```

Localized output:

```bash
codex-receipts generate --output html --locale ko
codex-receipts generate --output html --locale ja
codex-receipts generate --output html --locale zh
```

Custom receipt copy:

```bash
codex-receipts generate --cashier-label "담당" --cashier "Codex Bot" --footer-message "오늘도 수고했음"
```

Thermal printer output:

```bash
codex-receipts generate --output printer --printer usb
```

USB printer targeting:

```bash
codex-receipts generate --output printer --printer usb:VID:PID
codex-receipts generate --output printer --printer tcp://HOST:9100
codex-receipts generate --output printer --printer CUPS_PRINTER_NAME
```

Specific session id, id prefix, or thread-name fragment:

```bash
codex-receipts generate --session 019de4e1
codex-receipts generate --session "Codex project"
```

Multiple outputs:

```bash
codex-receipts generate --output console,html
```

Override receipt location:

```bash
codex-receipts generate --location "Cheonan, KR"
```

## Privacy And Side Effects

- Codex Receipts reads local Codex logs from `~/.codex/session_index.jsonl` and `~/.codex/sessions/**/*.jsonl`.
- It writes generated receipts under `~/.codex-receipts`.
- The CLI reads the local logs to calculate activity counts, but generated receipts do not reproduce prompt or assistant-reply bodies.
- Receipt generation does not upload session contents or public IP information. Installing or updating the CLI is a separate, user-controlled action.
- The MCP `list_codex_sessions` tool returns local session paths and thread names to the connected local MCP client. Use it only when the user asks to list or search sessions.
- Generated receipts contain a session identifier or slug, activity counts, token totals when available, and user-supplied receipt text.
- TCP printer output opens an outbound connection to the user-supplied printer address. Use printer output only when the user explicitly requests it.

## Agent Workflow

1. Choose the session target: latest by default, or pass `--session` when the user gives a session id, prefix, or thread-name fragment.
2. Choose output: use `console` for chat-friendly terminal output, `html` for a shareable local file, and `printer` only when the user asks to print.
3. Choose language: default to English unless the user asks for Korean, Japanese, or Chinese, then pass `--locale ko`, `--locale ja`, or `--locale zh`.
4. Verify the installed CLI version, then run `codex-receipts generate` with the selected flags.
5. Report the generated output path for HTML receipts. For console receipts, summarize or relay the important terminal output.
6. If printer output fails, report the exact error. For USB printer-not-found errors, point out the visible `VID:PID` list and suggest retrying with `--printer usb:VID:PID`, `--printer tcp://HOST:9100`, or a CUPS printer name.
7. If the command fails for another reason, report the exact error and do not manually parse Codex logs unless the user explicitly asks for debugging.
