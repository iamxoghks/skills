import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { DataFetcher } from "./data-fetcher.js";
import { TranscriptParser } from "./transcript-parser.js";
import { ReceiptGenerator } from "./receipt-generator.js";
import { HtmlRenderer } from "./html-renderer.js";
import { ConfigManager } from "./config-manager.js";
import { LocationDetector } from "../utils/location.js";
import type { ReceiptData } from "./receipt-generator.js";

export interface GenerateReceiptRequest {
  session?: string;
  location?: string;
  saveHtml?: boolean;
}

export interface GenerateReceiptResult {
  receiptData: ReceiptData;
  receipt: string;
  htmlPath?: string;
}

export class ReceiptService {
  private dataFetcher = new DataFetcher();
  private transcriptParser = new TranscriptParser();
  private receiptGenerator = new ReceiptGenerator();
  private htmlRenderer = new HtmlRenderer();
  private configManager = new ConfigManager();
  private locationDetector = new LocationDetector();

  async generateReceipt(
    request: GenerateReceiptRequest = {},
  ): Promise<GenerateReceiptResult> {
    const config = await this.configManager.loadConfig();
    const sessionData = await this.dataFetcher.fetchSessionData(request.session);

    if (!sessionData.projectPath) {
      throw new Error("Cannot determine Codex session path.");
    }

    const transcriptData = await this.transcriptParser.parseTranscript(
      sessionData.projectPath,
    );
    const location =
      request.location || (await this.locationDetector.getLocation(config));
    const receiptData = {
      sessionData,
      transcriptData,
      location,
      config,
    };
    const receipt = this.receiptGenerator.generateReceipt(receiptData);

    if (!request.saveHtml) {
      return { receiptData, receipt };
    }

    const htmlPath = await this.saveHtmlReceipt(receiptData, receipt);
    return { receiptData, receipt, htmlPath };
  }

  private async saveHtmlReceipt(
    receiptData: ReceiptData,
    receipt: string,
  ): Promise<string> {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const fileName =
      receiptData.transcriptData.sessionSlug ||
      receiptData.sessionData.sessionId;
    const outputPath = resolve(
      join(home, ".codex-receipts", "projects", `${fileName}.html`),
    );
    const html = this.htmlRenderer.generateHtml(receiptData, receipt);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf-8");

    return outputPath;
  }
}
