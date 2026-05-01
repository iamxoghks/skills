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
- The user asks whether receipt generation is local/private.

## Required Tool

Use the published npm CLI:

```bash
npx codex-receipts generate
```

Do not reimplement receipt parsing in the agent. Prefer the CLI so output behavior stays aligned with the package.

## Common Commands

Latest session, default output:

```bash
npx codex-receipts generate
```

Console output:

```bash
npx codex-receipts generate --output console
```

HTML output:

```bash
npx codex-receipts generate --output html
```

Thermal printer output:

```bash
npx codex-receipts generate --output printer --printer usb
```

Specific session id, id prefix, or thread-name fragment:

```bash
npx codex-receipts generate --session 019de4e1
npx codex-receipts generate --session "Codex project"
```

Multiple outputs:

```bash
npx codex-receipts generate --output console,html
```

Override receipt location:

```bash
npx codex-receipts generate --location "Cheonan, KR"
```

## Privacy Notes

- Codex Receipts reads local Codex logs from `~/.codex/session_index.jsonl` and `~/.codex/sessions/**/*.jsonl`.
- It writes generated receipts under `~/.codex-receipts`.
- Receipt generation does not send session contents or public IP information to a remote service.
- Receipts include visible session activity such as prompts, assistant replies, tool calls, and token usage if Codex logged it.

## Agent Workflow

1. Choose the session target: latest by default, or pass `--session` when the user gives a session id, prefix, or thread-name fragment.
2. Choose output: use `console` for chat-friendly terminal output, `html` for a shareable local file, and `printer` only when the user asks to print.
3. Run `npx codex-receipts generate` with the selected flags.
4. Report the generated output path for HTML receipts. For console receipts, summarize or relay the important terminal output.
5. If the command fails, report the exact error and do not manually parse Codex logs unless the user explicitly asks for debugging.

