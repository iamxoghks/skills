import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { HtmlRenderer } from "../dist/core/html-renderer.js";
import { getPrinterLocaleWarning } from "../dist/utils/printer-warning.js";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const cli = [
  process.execPath,
  "--import",
  new URL("./smoke-fixture-preload.mjs", import.meta.url).href,
  fileURLToPath(new URL("../bin/codex-receipts.js", import.meta.url)),
];
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

const fixtureRoot = await mkdtemp(join(tmpdir(), "codex-receipts-smoke-"));
const fixtureSessionId = "00000000-0000-4000-8000-000000000002";
const olderSessionId = "00000000-0000-4000-8000-000000000001";
const testEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    CODEX_RECEIPTS_SMOKE_FIXTURE: fixtureRoot,
    NO_COLOR: "1",
  }).filter(([, value]) => typeof value === "string"),
);

try {
  await createFixtureSessions();
  const initialFiles = await listFixtureFiles(fixtureRoot);
  runCli(["--version"], packageJson.version);
  runCli(["--help"], "Usage: codex-receipts");
  runCli(["generate", "--help"], "Generate a receipt for a Codex session");
  testHtmlEscaping();
  testPrinterLocaleWarning();
  runCli(["generate", "--output", "console"], "Proof of work");
  runCli(
    ["generate", "--session", "Smoke fixture", "--output", "console", "--locale", "ko"],
    "사용자 프롬프트",
  );
  await runMcpSmokeTest();
  assert.deepEqual(await listFixtureFiles(fixtureRoot), initialFiles);
  console.log("CLI, MCP, localization, and HTML escaping smoke tests passed using isolated fixtures.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

function runCli(args, expectedText) {
  const result = spawnSync(cli[0], [...cli.slice(1), ...args], {
    encoding: "utf-8",
    cwd: packageRoot,
    env: testEnv,
    input: "",
    timeout: 15_000,
    maxBuffer: 1_000_000,
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${args.join(" ")}\n${result.error || result.stderr}`,
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
    cwd: packageRoot,
    env: testEnv,
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, "codex-receipts");
    assert.equal(client.getServerVersion()?.version, packageJson.version);
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
    assert.notEqual(sessions.isError, true);
    const sessionList = readStructuredResult(sessions).sessions;
    assert.equal(sessionList.length, 1);
    assert.equal(sessionList[0].sessionId, fixtureSessionId);
    assert.equal(sessionList[0].threadName, "Smoke fixture session");
    assert.equal(sessionList[0].totalTokens, 240);
    assert.deepEqual(sessionList[0].modelsUsed, ["codex"]);

    const filtered = await client.callTool({
      name: "list_codex_sessions",
      arguments: { limit: 10, query: "Older fixture" },
    });
    assert.notEqual(filtered.isError, true);
    assert.deepEqual(
      readStructuredResult(filtered).sessions.map((session) => session.sessionId),
      [olderSessionId],
    );

    const generated = await client.callTool({
      name: "generate_codex_receipt",
      arguments: {
        session: "Smoke fixture",
        location: "Test Lab",
        locale: "ko",
        cashierLabel: "담당",
        cashier: "Fixture Bot",
        footerMessage: "Fixture only.",
        saveHtml: false,
      },
    });
    assert.notEqual(generated.isError, true);
    const receipt = readStructuredResult(generated);
    assert.equal(receipt.sessionId, fixtureSessionId);
    assert.equal(receipt.totalTokens, 240);
    assert.ok(receipt.totalPoints > 0);
    assert.equal(receipt.htmlPath, undefined);
    assert.equal(receipt.printer, undefined);
    for (const expected of ["위치: Test Lab", "사용자 프롬프트", "컨텍스트 토큰", "담당: Fixture Bot", "Fixture only."]) {
      assert.ok(receipt.receipt.includes(expected), `MCP Korean receipt is missing ${expected}.`);
    }
    assert.ok(generated.content.some((part) => part.type === "text" && part.text.includes("위치: Test Lab")));

    let invalidArgumentsRejected = false;
    try {
      const invalid = await client.callTool({
        name: "list_codex_sessions",
        arguments: { limit: 0 },
      });
      invalidArgumentsRejected = invalid.isError === true;
    } catch (error) {
      invalidArgumentsRejected = /invalid|validation|argument|limit/i.test(String(error));
    }
    assert.ok(invalidArgumentsRejected, "MCP must reject a session limit of 0.");
  } finally {
    await client.close();
  }
}

function readStructuredResult(result) {
  const text = result.content.find((part) => part.type === "text")?.text;
  assert.ok(text, "MCP result must contain text content.");
  if (result.structuredContent) return result.structuredContent;
  return JSON.parse(text);
}

async function createFixtureSessions() {
  const codexDir = join(fixtureRoot, ".codex");
  const sessionDir = join(codexDir, "sessions", "2026", "01");
  await mkdir(sessionDir, { recursive: true });
  await writeFile(join(fixtureRoot, "smoke-fixture.json"), JSON.stringify({ fixture: true }));
  await writeFile(
    join(codexDir, "session_index.jsonl"),
    [
      { id: olderSessionId, thread_name: "Older fixture session", updated_at: "2026-01-01T00:00:00.000Z" },
      { id: fixtureSessionId, thread_name: "Smoke fixture session", updated_at: "2026-01-02T00:00:06.000Z" },
    ].map((entry) => JSON.stringify(entry)).join("\n") + "\n{partial\n",
  );
  for (const [id, day, totalTokens] of [
    [olderSessionId, "01", 42],
    [fixtureSessionId, "02", 240],
  ]) {
    const timestamp = (second) => `2026-01-${day}T00:00:0${second}.000Z`;
    const entries = [
      { timestamp: timestamp(0), type: "session_meta", payload: { id, cwd: "fixture-project" } },
      { timestamp: timestamp(0), type: "turn_context", payload: { model: "codex" } },
      { timestamp: timestamp(1), type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Explain this generic example." }] } },
      { timestamp: timestamp(2), type: "response_item", payload: { type: "reasoning" } },
      { timestamp: timestamp(3), type: "response_item", payload: { type: "function_call", name: "example_tool" } },
      { timestamp: timestamp(4), type: "response_item", payload: { type: "function_call_output" } },
      { timestamp: timestamp(5), type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "A generic example is explained." }] } },
      { timestamp: timestamp(6), type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: totalTokens - 10, output_tokens: 10, cached_input_tokens: 5, reasoning_output_tokens: 2, total_tokens: totalTokens } } } },
    ];
    await writeFile(
      join(sessionDir, `rollout-2026-01-${day}-${id}.jsonl`),
      entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n{partial\n",
    );
  }
}

async function listFixtureFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFixtureFiles(join(directory, entry.name), relative));
    } else {
      files.push([relative, await readFile(join(directory, entry.name), "utf-8")]);
    }
  }
  return files.sort(([left], [right]) => left.localeCompare(right));
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

  const koreanHtml = renderer.generateHtml(
    {
      location: "천안",
      config: { timezone: "UTC", locale: "ko" },
      transcriptData: {
        sessionId: "session-id",
        sessionSlug: "session-id",
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
            modelName: "User prompts",
            inputTokens: 1,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 3,
          },
          {
            modelName: "Assistant replies",
            inputTokens: 0,
            outputTokens: 1,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 5,
          },
          {
            modelName: "Tool calls",
            inputTokens: 1,
            outputTokens: 1,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 10,
          },
          {
            modelName: "Context tokens",
            inputTokens: 1000,
            outputTokens: 100,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            cost: 2,
          },
        ],
        projectPath: "/tmp/session.jsonl",
      },
    },
    "receipt",
  );

  for (const expected of [
    "위치",
    "세션",
    "날짜",
    "합계",
    "연봉 협상 때 이거 언급해.",
    "사용자 프롬프트",
    "어시스턴트 응답",
    "도구 호출",
    "컨텍스트 토큰",
  ]) {
    if (!koreanHtml.includes(expected)) {
      throw new Error(`Korean HTML receipt is missing "${expected}".`);
    }
  }

  const customizedHtml = renderer.generateHtml(
    {
      location: "The Cloud",
      config: {
        timezone: "UTC",
        cashierLabel: "Operator",
        cashier: "Codex Bot",
        footerMessage: "Printed on purpose.",
      },
      transcriptData: {
        sessionId: "session-id",
        sessionSlug: "session-id",
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
        modelsUsed: ["gpt-5.5"],
        modelBreakdowns: [],
        projectPath: "/tmp/session.jsonl",
      },
    },
    "receipt",
  );

  for (const expected of ["Operator: Codex Bot", "Printed on purpose."]) {
    if (!customizedHtml.includes(expected)) {
      throw new Error(`Customized HTML receipt is missing "${expected}".`);
    }
  }

  if (customizedHtml.includes("CASHIER: GPT-5.5")) {
    throw new Error("Customized HTML receipt leaked the default cashier text.");
  }

  const japaneseHtml = renderer.generateHtml(
    {
      ...baseReceiptData("東京", "ja"),
      sessionData: {
        ...baseSessionData(),
        modelBreakdowns: [{ ...baseBreakdown(), modelName: "User prompts" }],
      },
    },
    "receipt",
  );
  for (const expected of ["場所", "合計", "ユーザープロンプト"]) {
    if (!japaneseHtml.includes(expected)) {
      throw new Error(`Japanese HTML receipt is missing "${expected}".`);
    }
  }

  const chineseHtml = renderer.generateHtml(
    {
      ...baseReceiptData("上海", "zh"),
      sessionData: {
        ...baseSessionData(),
        modelBreakdowns: [{ ...baseBreakdown(), modelName: "Tool calls" }],
      },
    },
    "receipt",
  );
  for (const expected of ["位置", "合计", "工具调用"]) {
    if (!chineseHtml.includes(expected)) {
      throw new Error(`Chinese HTML receipt is missing "${expected}".`);
    }
  }
}

function testPrinterLocaleWarning() {
  const baseData = {
    location: "The Cloud",
    transcriptData: {
      sessionId: "session-id",
      sessionSlug: "session-id",
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
      modelBreakdowns: [],
      projectPath: "/tmp/session.jsonl",
    },
  };

  if (getPrinterLocaleWarning({ ...baseData, config: { locale: "en" } })) {
    throw new Error("English receipts should not emit a localized printer warning.");
  }

  for (const locale of ["ko", "ja", "zh"]) {
    const warning = getPrinterLocaleWarning({
      ...baseData,
      config: { locale },
    });
    if (!warning?.includes("UTF-8") || !warning.includes("code page")) {
      throw new Error(`${locale} printer warning is missing UTF-8/codepage guidance.`);
    }
  }
}

function baseReceiptData(location, locale) {
  return {
    location,
    config: { timezone: "UTC", locale },
    transcriptData: {
      sessionId: "session-id",
      sessionSlug: "session-id",
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
    sessionData: baseSessionData(),
  };
}

function baseSessionData() {
  return {
    sessionId: "session-id",
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelsUsed: ["codex"],
    modelBreakdowns: [],
    projectPath: "/tmp/session.jsonl",
  };
}

function baseBreakdown() {
  return {
    modelName: "codex",
    inputTokens: 1,
    outputTokens: 1,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    cost: 1,
  };
}
