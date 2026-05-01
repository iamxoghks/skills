import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DataFetcher } from "../core/data-fetcher.js";
import { ReceiptService } from "../core/receipt-service.js";

export class McpCommand {
  async execute(): Promise<void> {
    const dataFetcher = new DataFetcher();
    const receiptService = new ReceiptService();
    const server = new McpServer({
      name: "codex-receipts",
      version: "1.2.0",
    });

    server.registerTool(
      "list_codex_sessions",
      {
        title: "List Codex Sessions",
        description:
          "List recent local Codex sessions from ~/.codex without sending data remotely.",
        inputSchema: {
          limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum number of sessions to return. Defaults to 10."),
          query: z
            .string()
            .optional()
            .describe("Optional session id, path, or thread-name filter."),
        },
      },
      async ({ limit, query }) => {
        const sessions = await dataFetcher.listSessions({ limit, query });
        const structuredContent = { sessions };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        };
      },
    );

    server.registerTool(
      "generate_codex_receipt",
      {
        title: "Generate Codex Receipt",
        description:
          "Generate a receipt for a local Codex session. Reads only local Codex logs, can save HTML, and can optionally attempt physical printer output.",
        inputSchema: {
          session: z
            .string()
            .optional()
            .describe(
              "Session id, id prefix, or thread-name fragment. Defaults to the most recent session.",
            ),
          location: z
            .string()
            .optional()
            .describe("Optional location text to print on the receipt."),
          locale: z
            .enum(["en", "ko", "ja", "zh"])
            .optional()
            .describe("Optional receipt language. Defaults to config or en."),
          cashierLabel: z
            .string()
            .optional()
            .describe("Optional override for the cashier label."),
          cashier: z
            .string()
            .optional()
            .describe(
              "Optional override for the cashier value. Defaults to the model name from the Codex session.",
            ),
          footerMessage: z
            .string()
            .optional()
            .describe("Optional override for the receipt footer message."),
          saveHtml: z
            .boolean()
            .optional()
            .describe(
              "When true, save an HTML receipt under ~/.codex-receipts/projects.",
            ),
          printer: z
            .string()
            .optional()
            .describe(
              'Optional printer interface: "usb", "usb:VID:PID", "tcp://HOST:9100", or a CUPS printer name. Printer failures are returned in the tool result.',
            ),
        },
      },
      async ({
        session,
        location,
        locale,
        cashierLabel,
        cashier,
        footerMessage,
        saveHtml,
        printer,
      }) => {
        const result = await receiptService.generateReceipt({
          session,
          location,
          locale,
          cashierLabel,
          cashier,
          footerMessage,
          saveHtml: saveHtml || !!printer,
          printer,
        });
        const structuredContent = {
          sessionId: result.receiptData.sessionData.sessionId,
          sessionSlug: result.receiptData.transcriptData.sessionSlug,
          totalTokens: result.receiptData.sessionData.totalTokens,
          totalPoints: result.receiptData.sessionData.totalCost,
          htmlPath: result.htmlPath,
          printer: result.printer,
          receipt: result.receipt,
        };
        const printerWarning = result.printer?.warning
          ? `\n\nPrinter note:\n${result.printer.warning}`
          : "";
        const summary = result.printer?.ok === false
          ? `${result.receipt}${printerWarning}\n\nPrinter output failed:\n${result.printer.error}\n\nHTML receipt saved: ${result.htmlPath || "(not saved)"}`
          : `${result.receipt}${printerWarning}`;

        return {
          content: [
            {
              type: "text",
              text: summary,
            },
          ],
          structuredContent,
        };
      },
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}
