// Test-only redirects for subprocess smoke checks. Production commands never
// import this module. Keep the real environment's home directory unchanged.
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { DataFetcher } from "../dist/core/data-fetcher.js";
import { ConfigManager } from "../dist/core/config-manager.js";
import { TranscriptParser } from "../dist/core/transcript-parser.js";
import { ReceiptService } from "../dist/core/receipt-service.js";
import { ThermalPrinterRenderer } from "../dist/core/thermal-printer.js";
import { GenerateCommand } from "../dist/commands/generate.js";
import { DEFAULT_CONFIG } from "../dist/types/config.js";

assert.ok(process.env.CODEX_RECEIPTS_SMOKE_FIXTURE, "Missing isolated smoke fixture.");
const fixtureRoot = await realpath(process.env.CODEX_RECEIPTS_SMOKE_FIXTURE);
const temporaryRoot = await realpath(tmpdir());
assertInside(temporaryRoot, fixtureRoot);
const marker = JSON.parse(await readFile(join(fixtureRoot, "smoke-fixture.json"), "utf-8"));
assert.equal(marker.fixture, true, "Not a smoke fixture directory.");

function assertInside(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  assert.ok(
    pathFromRoot && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(pathFromRoot),
    "Smoke tests must only access files inside their disposable fixture.",
  );
}

function replaceMethod(prototype, name, replacement) {
  assert.equal(typeof prototype[name], "function", `Missing fixture redirect target: ${name}`);
  prototype[name] = replacement;
}

replaceMethod(DataFetcher.prototype, "readSessionIndex", async function () {
  const text = await readFile(join(fixtureRoot, ".codex", "session_index.jsonl"), "utf-8");
  return this.parseJsonl(text);
});
replaceMethod(DataFetcher.prototype, "listSessionFiles", async function () {
  return this.walkJsonl(join(fixtureRoot, ".codex", "sessions"));
});

const readCodexSession = DataFetcher.prototype.readCodexSession;
replaceMethod(DataFetcher.prototype, "readCodexSession", async function (file) {
  assertInside(fixtureRoot, await realpath(file));
  return readCodexSession.call(this, file);
});
const parseTranscript = TranscriptParser.prototype.parseTranscript;
replaceMethod(TranscriptParser.prototype, "parseTranscript", async function (file) {
  assertInside(fixtureRoot, await realpath(file));
  return parseTranscript.call(this, file);
});

replaceMethod(ConfigManager.prototype, "loadConfig", async function () {
  return { ...DEFAULT_CONFIG, timezone: "UTC", location: "Fixture Lab", locale: "en" };
});
replaceMethod(ConfigManager.prototype, "getConfigPath", function () {
  return join(fixtureRoot, "unused.config.json");
});

const rejectSideEffect = async function () {
  throw new Error("Smoke fixtures prohibit configuration writes, saved output, browsers, and physical printers.");
};
replaceMethod(ConfigManager.prototype, "saveConfig", rejectSideEffect);
replaceMethod(ReceiptService.prototype, "saveHtmlReceipt", rejectSideEffect);
replaceMethod(ThermalPrinterRenderer.prototype, "printReceipt", rejectSideEffect);
replaceMethod(GenerateCommand.prototype, "saveHtmlFile", rejectSideEffect);
replaceMethod(GenerateCommand.prototype, "openInBrowser", rejectSideEffect);
