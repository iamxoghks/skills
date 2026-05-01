import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { HtmlRenderer } from "../dist/core/html-renderer.js";

const cli = ["node", "bin/codex-receipts.js"];

runCli(["--help"], "Usage: codex-receipts");
runCli(["generate", "--help"], "Generate a receipt for a Codex session");
testHtmlEscaping();

const hasCodexSessions =
  existsSync(`${process.env.HOME}/.codex/session_index.jsonl`) ||
  existsSync(`${process.env.HOME}/.codex/sessions`);

if (hasCodexSessions) {
  runCli(["generate", "--output", "console"], "Proof of work");
  await runMcpSmokeTest();
} else {
  console.log("Skipping session-dependent smoke tests: no local Codex sessions found.");
}

function runCli(args, expectedText) {
  const result = spawnSync(cli[0], [...cli.slice(1), ...args], {
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${cli.join(" ")} ${args.join(" ")}\n${result.stderr}`,
    );
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes(expectedText)) {
    throw new Error(
      `Expected output to include "${expectedText}" for ${args.join(" ")}`,
    );
  }
}

async function runMcpSmokeTest() {
  const client = new Client({
    name: "codex-receipts-smoke-test",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: cli[0],
    args: [...cli.slice(1), "mcp"],
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    for (const expected of ["list_codex_sessions", "generate_codex_receipt"]) {
      if (!toolNames.includes(expected)) {
        throw new Error(`MCP tool missing: ${expected}`);
      }
    }

    const sessions = await client.callTool({
      name: "list_codex_sessions",
      arguments: { limit: 1 },
    });
    const text =
      sessions.content?.[0]?.type === "text" ? sessions.content[0].text : "";
    if (!text.includes("sessions")) {
      throw new Error("MCP list_codex_sessions did not return session text.");
    }
  } finally {
    await client.close();
  }
}

function testHtmlEscaping() {
  const renderer = new HtmlRenderer();
  const maliciousSessionSlug = `x</title><script>alert('receipt')</script>`;
  const html = renderer.generateHtml(
    {
      location: `<img src=x onerror=alert('location')>`,
      config: { timezone: "UTC" },
      transcriptData: {
        sessionId: "session-id",
        sessionSlug: maliciousSessionSlug,
        startTime: new Date("2026-01-01T00:00:00.000Z"),
        endTime: new Date("2026-01-01T00:00:00.000Z"),
        messages: [],
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        toolUses: 0,
        filesModified: [],
        commandsRun: [],
      },
      sessionData: {
        sessionId: "session-id",
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        modelsUsed: ["codex"],
        modelBreakdowns: [
          {
            modelName: `<script>alert('model')</script>`,
            inputTokens: 1,
            outputTokens: 1,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 1,
          },
        ],
        projectPath: "/tmp/session.jsonl",
      },
    },
    "receipt",
  );

  if (html.includes(maliciousSessionSlug)) {
    throw new Error("HTML renderer emitted an unescaped session slug.");
  }

  if (html.includes("<img src=x") || html.includes("<script>alert(")) {
    throw new Error("HTML renderer emitted unescaped user-controlled markup.");
  }
}
