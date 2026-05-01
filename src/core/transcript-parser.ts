import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { basename } from "path";
import type { ParsedTranscript } from "../types/transcript.js";

interface CodexLogEntry {
  timestamp?: string;
  type?: string;
  payload?: {
    id?: string;
    cwd?: string;
    type?: string;
    role?: "user" | "assistant" | "developer";
    content?: Array<{ type: string; text?: string }>;
    message?: string;
  };
}

export class TranscriptParser {
  async parseTranscript(transcriptPath: string): Promise<ParsedTranscript> {
    const expandedPath = transcriptPath.replace(/^~/, process.env.HOME || "");

    if (!existsSync(expandedPath)) {
      throw new Error(`Codex session file not found: ${transcriptPath}`);
    }

    const content = await readFile(expandedPath, "utf-8");
    const messages = this.parseJsonl(content);

    const meta = messages.find((message) => message.type === "session_meta");
    const responseItems = messages.filter((message) => message.type === "response_item");
    const userMessages = responseItems.filter(
      (message) =>
        message.payload?.type === "message" && message.payload.role === "user",
    );
    const assistantMessages = responseItems.filter(
      (message) =>
        message.payload?.type === "message" &&
        message.payload.role === "assistant",
    );

    const timestamps = messages
      .filter((message) => message.timestamp)
      .map((message) => new Date(message.timestamp!));

    const startTime = timestamps[0] || new Date();
    const endTime = timestamps[timestamps.length - 1] || new Date();

    return {
      sessionSlug: this.slugify(
        meta?.payload?.id || basename(expandedPath).replace(/\.jsonl$/, ""),
      ),
      firstPrompt: this.extractPromptText(userMessages[0]),
      startTime,
      endTime,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      totalMessages: responseItems.length,
    };
  }

  private extractPromptText(message: CodexLogEntry | undefined): string {
    const content = message?.payload?.content;
    if (!content) return "No prompt available";

    const text = content
      .filter((part) => part.type === "input_text" && part.text)
      .map((part) => part.text)
      .join(" ");

    return this.truncateText(text || "No prompt available", 100);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  private parseJsonl(content: string): CodexLogEntry[] {
    const entries: CodexLogEntry[] = [];
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as CodexLogEntry);
      } catch {
        // Codex can leave a final JSONL line partial if a write is interrupted.
        // Skip corrupt lines instead of failing the entire receipt.
      }
    }
    return entries;
  }
}
