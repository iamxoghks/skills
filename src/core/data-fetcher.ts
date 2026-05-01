import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { basename, join } from "path";
import type {
  CodexSessionUsage,
  ModelBreakdown,
} from "../types/codex-usage.js";

interface CodexSessionIndexEntry {
  id: string;
  thread_name?: string;
  updated_at?: string;
}

interface CodexLogEntry {
  timestamp?: string;
  type?: string;
  payload?: {
    id?: string;
    cwd?: string;
    model?: string;
    model_provider?: string;
    type?: string;
    role?: string;
    name?: string;
    info?: {
      total_token_usage?: {
        input_tokens?: number;
        cached_input_tokens?: number;
        output_tokens?: number;
        reasoning_output_tokens?: number;
        total_tokens?: number;
      };
    };
  };
}

export class DataFetcher {
  async fetchSessionById(sessionId: string): Promise<CodexSessionUsage> {
    const sessionFile = await this.findSessionFile(sessionId);
    if (!sessionFile) {
      throw new Error(`No Codex session matching "${sessionId}"`);
    }

    return this.readCodexSession(sessionFile);
  }

  async fetchSessionData(sessionQuery?: string): Promise<CodexSessionUsage> {
    const sessionFile = sessionQuery
      ? await this.findSessionFile(sessionQuery)
      : await this.getMostRecentSessionFile();

    if (!sessionFile) {
      throw new Error(
        sessionQuery
          ? `No Codex session matching "${sessionQuery}"`
          : "No Codex sessions found under ~/.codex/sessions",
      );
    }

    return this.readCodexSession(sessionFile);
  }

  async getMostRecentSessionId(): Promise<string> {
    const sessionData = await this.fetchSessionData();
    return sessionData.sessionId;
  }

  private async readCodexSession(
    sessionFile: string,
  ): Promise<CodexSessionUsage> {
    const content = await readFile(sessionFile, "utf-8");
    const entries = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as CodexLogEntry);

    const meta = entries.find((entry) => entry.type === "session_meta");
    const turnContext = entries.find((entry) => entry.type === "turn_context");
    const responseItems = entries.filter((entry) => entry.type === "response_item");
    const eventMessages = entries.filter((entry) => entry.type === "event_msg");

    const userMessages = responseItems.filter(
      (entry) => entry.payload?.type === "message" && entry.payload.role === "user",
    ).length;
    const assistantMessages = responseItems.filter(
      (entry) =>
        entry.payload?.type === "message" && entry.payload.role === "assistant",
    ).length;
    const toolCalls = responseItems.filter(
      (entry) => entry.payload?.type === "function_call",
    ).length;
    const toolOutputs = responseItems.filter(
      (entry) => entry.payload?.type === "function_call_output",
    ).length;
    const reasoningItems = responseItems.filter(
      (entry) => entry.payload?.type === "reasoning",
    ).length;

    const tokenUsage = [...eventMessages]
      .reverse()
      .map((entry) => entry.payload?.info?.total_token_usage)
      .find(Boolean);

    const inputTokens = tokenUsage?.input_tokens || 0;
    const outputTokens = tokenUsage?.output_tokens || 0;
    const cacheReadTokens = tokenUsage?.cached_input_tokens || 0;
    const reasoningTokens = tokenUsage?.reasoning_output_tokens || 0;
    const totalTokens =
      tokenUsage?.total_tokens ||
      inputTokens + outputTokens + cacheReadTokens + reasoningTokens;

    const modelName = turnContext?.payload?.model || meta?.payload?.model || "codex";
    const workUnits =
      userMessages * 3 +
      assistantMessages * 5 +
      toolCalls * 8 +
      toolOutputs * 2 +
      reasoningItems * 4 +
      Math.ceil(totalTokens / 1000);

    const modelBreakdowns: ModelBreakdown[] = [
      {
        modelName: "User prompts",
        inputTokens: userMessages,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        cost: userMessages * 3,
      },
      {
        modelName: "Assistant replies",
        inputTokens: 0,
        outputTokens: assistantMessages,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        cost: assistantMessages * 5,
      },
      {
        modelName: "Tool calls",
        inputTokens: toolCalls,
        outputTokens: toolOutputs,
        cacheCreationTokens: reasoningItems,
        cacheReadTokens: 0,
        cost: toolCalls * 8 + toolOutputs * 2 + reasoningItems * 4,
      },
    ];

    if (totalTokens > 0) {
      modelBreakdowns.push({
        modelName: "Context tokens",
        inputTokens,
        outputTokens,
        cacheCreationTokens: reasoningTokens,
        cacheReadTokens,
        cost: Math.ceil(totalTokens / 1000),
      });
    }

    return {
      sessionId: meta?.payload?.id || this.extractIdFromFile(sessionFile),
      inputTokens,
      outputTokens,
      cacheCreationTokens: reasoningTokens,
      cacheReadTokens,
      totalTokens,
      totalCost: workUnits,
      modelsUsed: [modelName],
      modelBreakdowns,
      projectPath: sessionFile,
      lastActivity: entries[entries.length - 1]?.timestamp,
    };
  }

  private async findSessionFile(sessionQuery: string): Promise<string | undefined> {
    const fromIndex = await this.findSessionIdFromIndex(sessionQuery);
    const query = fromIndex || sessionQuery;
    const files = await this.listSessionFiles();

    return files
      .sort()
      .reverse()
      .find((file) => basename(file).includes(query) || file.includes(query));
  }

  private async findSessionIdFromIndex(
    sessionQuery: string,
  ): Promise<string | undefined> {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const indexPath = join(home, ".codex", "session_index.jsonl");
    if (!existsSync(indexPath)) return undefined;

    const content = await readFile(indexPath, "utf-8");
    const entries = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as CodexSessionIndexEntry);

    const match = [...entries].reverse().find((entry) => {
      return (
        entry.id === sessionQuery ||
        entry.id.startsWith(sessionQuery) ||
        entry.thread_name?.toLowerCase().includes(sessionQuery.toLowerCase())
      );
    });

    return match?.id;
  }

  private async getMostRecentSessionFile(): Promise<string | undefined> {
    const files = await this.listSessionFiles();
    return files.sort().at(-1);
  }

  private async listSessionFiles(): Promise<string[]> {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const sessionsDir = join(home, ".codex", "sessions");
    if (!existsSync(sessionsDir)) return [];
    return this.walkJsonl(sessionsDir);
  }

  private async walkJsonl(dir: string): Promise<string[]> {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map(async (dirent) => {
        const fullPath = join(dir, dirent.name);
        if (dirent.isDirectory()) return this.walkJsonl(fullPath);
        return dirent.isFile() && dirent.name.endsWith(".jsonl") ? [fullPath] : [];
      }),
    );
    return files.flat();
  }

  private extractIdFromFile(sessionFile: string): string {
    return basename(sessionFile).replace(/^rollout-/, "").replace(/\.jsonl$/, "");
  }
}
