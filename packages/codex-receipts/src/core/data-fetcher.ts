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

export interface CodexSessionSummary {
  sessionId: string;
  sessionFile: string;
  threadName?: string;
  updatedAt?: string;
  lastActivity?: string;
  totalTokens: number;
  totalCost: number;
  modelsUsed?: string[];
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
  async listSessions(options: {
    limit?: number;
    query?: string;
  } = {}): Promise<CodexSessionSummary[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 10, 100));
    const query = options.query?.toLowerCase();
    const indexEntries = await this.readSessionIndex();
    const indexById = new Map(indexEntries.map((entry) => [entry.id, entry]));
    const files = (await this.listSessionFiles()).sort().reverse();
    const sessions: CodexSessionSummary[] = [];

    for (const file of files) {
      const sessionData = await this.readCodexSession(file);
      const indexEntry = indexById.get(sessionData.sessionId);
      const searchable = [
        sessionData.sessionId,
        file,
        indexEntry?.thread_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) continue;

      sessions.push({
        sessionId: sessionData.sessionId,
        sessionFile: file,
        threadName: indexEntry?.thread_name,
        updatedAt: indexEntry?.updated_at,
        lastActivity: sessionData.lastActivity,
        totalTokens: sessionData.totalTokens,
        totalCost: sessionData.totalCost,
        modelsUsed: sessionData.modelsUsed,
      });

      if (sessions.length >= limit) break;
    }

    return sessions;
  }

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
    const entries = this.parseJsonl<CodexLogEntry>(content);

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
    const entries = await this.readSessionIndex();
    if (entries.length === 0) return undefined;

    const match = [...entries].reverse().find((entry) => {
      return (
        entry.id === sessionQuery ||
        entry.id.startsWith(sessionQuery) ||
        entry.thread_name?.toLowerCase().includes(sessionQuery.toLowerCase())
      );
    });

    return match?.id;
  }

  private async readSessionIndex(): Promise<CodexSessionIndexEntry[]> {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const indexPath = join(home, ".codex", "session_index.jsonl");
    if (!existsSync(indexPath)) return [];

    const content = await readFile(indexPath, "utf-8");
    return this.parseJsonl<CodexSessionIndexEntry>(content);
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

  private parseJsonl<T>(content: string): T[] {
    const entries: T[] = [];
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as T);
      } catch {
        // Codex session logs are append-only. Ignore partial/corrupt lines so
        // one bad local log does not break listing or receipt generation.
      }
    }
    return entries;
  }
}
