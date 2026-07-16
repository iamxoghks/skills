import { stdin } from "process";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import { execFile } from "child_process";
import { promisify } from "util";
import { DataFetcher } from "../core/data-fetcher.js";
import { TranscriptParser } from "../core/transcript-parser.js";
import { ReceiptGenerator } from "../core/receipt-generator.js";
import { HtmlRenderer } from "../core/html-renderer.js";
import { ThermalPrinterRenderer } from "../core/thermal-printer.js";
import { ConfigManager } from "../core/config-manager.js";
import { LocationDetector } from "../utils/location.js";
import { getPrinterLocaleWarning } from "../utils/printer-warning.js";
import type { ReceiptData } from "../core/receipt-generator.js";

const execFileAsync = promisify(execFile);

interface CodexHookData {
  session_id?: string;
  transcript_path?: string;
}

export type OutputFormat = "html" | "console" | "printer";

export interface GenerateOptions {
  session?: string;
  output?: string[];
  location?: string;
  printer?: string;
  locale?: "en" | "ko" | "ja" | "zh";
  cashierLabel?: string;
  cashier?: string;
  footerMessage?: string;
}

export class GenerateCommand {
  private dataFetcher = new DataFetcher();
  private transcriptParser = new TranscriptParser();
  private receiptGenerator = new ReceiptGenerator();
  private htmlRenderer = new HtmlRenderer();
  private thermalPrinter = new ThermalPrinterRenderer();
  private configManager = new ConfigManager();
  private locationDetector = new LocationDetector();

  async execute(options: GenerateOptions): Promise<void> {
    const spinner = ora("Generating receipt...").start();

    try {
      // Check if stdin has Codex session data.
      const stdinData = await this.readStdinIfAvailable();
      let transcriptPath: string | undefined;
      let actualSessionId: string | undefined;

      if (stdinData) {
        transcriptPath = stdinData.transcript_path;
        actualSessionId = stdinData.session_id;
      }

      // Load config
      const config = await this.configManager.loadConfig();

      // Fetch session data from local Codex logs
      spinner.text = "Fetching session data...";

      let sessionData;
      try {
        if (actualSessionId) {
          sessionData = await this.dataFetcher.fetchSessionById(actualSessionId);
        } else {
          sessionData =
            await this.dataFetcher.fetchSessionData(options.session);
        }
      } catch (err) {
        if (stdinData) {
          // Session not found yet. Exit silently rather than generating a receipt
          // for the wrong session.
          spinner.stop();
          return;
        }
        throw err;
      }

      // Determine transcript path if not from hook
      if (!transcriptPath) {
        if (
          sessionData.projectPath &&
          sessionData.projectPath !== "Unknown Project"
        ) {
          transcriptPath = sessionData.projectPath;
        } else {
          throw new Error(
            "Cannot determine Codex session path.",
          );
        }
      }

      // Parse transcript
      spinner.text = "Parsing transcript...";
      const transcriptData =
        await this.transcriptParser.parseTranscript(transcriptPath);

      // Get location
      const location =
        options.location || (await this.locationDetector.getLocation(config));

      // Generate receipt data
      spinner.text = "Generating receipt...";
      const receiptData = {
        sessionData,
        transcriptData,
        location,
        config: {
          ...config,
          locale: options.locale || config.locale,
          cashierLabel: options.cashierLabel || config.cashierLabel,
          cashier: options.cashier || config.cashier,
          footerMessage: options.footerMessage || config.footerMessage,
        },
      };

      const receipt = this.receiptGenerator.generateReceipt(receiptData);

      spinner.succeed("Receipt generated!");

      // Determine if we should output to console and/or file
      const isFromHook = !!stdinData;
      const outputFormats = [
        ...new Set(options.output || (isFromHook ? ["html"] : ["console"])),
      ] as OutputFormat[];

      const errors: Array<{ format: OutputFormat; error: Error }> = [];

      for (const format of outputFormats) {
        try {
          switch (format) {
            case "printer":
              await this.outputToPrinter(receiptData, options, config, spinner);
              break;
            case "html":
              await this.outputToHtml(
                receiptData,
                receipt,
                actualSessionId || sessionData.sessionId,
                transcriptData.sessionSlug,
                isFromHook,
              );
              break;
            case "console":
              this.outputToConsole(receipt);
              break;
          }
        } catch (err) {
          const error =
            err instanceof Error ? err : new Error("Unknown error");
          errors.push({ format, error });

          if (outputFormats.length > 1 && !isFromHook) {
            console.log(
              chalk.yellow(
                `\n⚠ ${format} output failed: ${error.message}`,
              ),
            );
          }
        }
      }

      if (errors.length === outputFormats.length) {
        // All outputs failed — throw the first error
        throw errors[0].error;
      }
    } catch (error) {
      spinner.fail("Failed to generate receipt");

      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      } else {
        console.error(chalk.red("An unknown error occurred"));
      }

      process.exit(1);
    }
  }

  /**
   * Send receipt to a thermal printer.
   */
  private async outputToPrinter(
    receiptData: ReceiptData,
    options: GenerateOptions,
    config: { printer?: string },
    spinner: ReturnType<typeof ora>,
  ): Promise<void> {
    const printerInterface = options.printer || config.printer;
    if (!printerInterface) {
      throw new Error(
        'No printer specified. Use --printer <name> or set via: codex-receipts config --set printer=EPSON_TM_T88V',
      );
    }

    const warning = getPrinterLocaleWarning(receiptData);
    if (warning) {
      spinner.info(warning);
    }

    spinner.start("Sending to printer...");
    await this.thermalPrinter.printReceipt(receiptData, printerInterface);
    spinner.succeed(`Receipt sent to printer: ${printerInterface}`);
  }

  /**
   * Save receipt as HTML and optionally open in browser
   */
  private async outputToHtml(
    receiptData: ReceiptData,
    receipt: string,
    sessionId: string,
    sessionSlug: string | undefined,
    isFromHook: boolean,
  ): Promise<void> {
    const fileName = sessionSlug || sessionId;
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const outputDir = `${home}/.codex-receipts/projects`;
    const fullPath = `${outputDir}/${fileName}.html`;

    const html = this.htmlRenderer.generateHtml(receiptData, receipt);
    await this.saveHtmlFile(html, fullPath);

    if (isFromHook) {
      await this.openInBrowser(fullPath);
    } else {
      console.log(chalk.cyan("\nTip: Open in browser to view!"));
    }
  }

  /**
   * Display receipt to console with formatting
   */
  private outputToConsole(receipt: string): void {
    this.displayToConsole(receipt);
  }

  /**
   * Check if stdin has data and read it
   */
  private async readStdinIfAvailable(): Promise<CodexHookData | null> {
    return new Promise((resolve) => {
      // Check if stdin is a TTY (interactive terminal) or piped
      if (stdin.isTTY) {
        resolve(null);
        return;
      }

      let data = "";
      const timeout = setTimeout(() => {
        resolve(null);
      }, 100); // 100ms timeout to avoid hanging

      stdin.setEncoding("utf-8");

      stdin.on("data", (chunk) => {
        data += chunk;
      });

      stdin.on("end", () => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed && typeof parsed === "object" ? parsed : null);
        } catch {
          resolve(null);
        }
      });

      // If no data after timeout, continue without stdin
      stdin.resume();
    });
  }

  /**
   * Display receipt to console with formatting
   */
  private displayToConsole(receipt: string): void {
    console.log(
      boxen(receipt, {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
      }),
    );
  }

  /**
   * Save HTML file
   */
  private async saveHtmlFile(html: string, outputPath: string): Promise<void> {
    const { writeFile, mkdir } = await import("fs/promises");
    const { dirname, resolve } = await import("path");

    const resolvedPath = resolve(this.expandPath(outputPath));
    const dir = dirname(resolvedPath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });

    // Write HTML to file
    await writeFile(resolvedPath, html, "utf-8");

    console.log(chalk.green(`Receipt saved to: ${resolvedPath}`));
  }

  /**
   * Open file in default browser
   */
  private async openInBrowser(filePath: string): Promise<void> {
    const platform = process.platform;

    try {
      if (platform === "darwin") {
        // macOS
        await execFileAsync("open", [filePath]);
      } else if (platform === "win32") {
        // Windows
        await execFileAsync("cmd", ["/c", "start", "", filePath]);
      } else {
        // Linux
        await execFileAsync("xdg-open", [filePath]);
      }
    } catch (error) {
      // Silently fail - file is still saved
      // Can't log error in hook context anyway
    }
  }

  /**
   * Expand ~ to home directory
   */
  private expandPath(path: string): string {
    if (path.startsWith("~/")) {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      return path.replace(/^~/, home);
    }
    return path;
  }
}
