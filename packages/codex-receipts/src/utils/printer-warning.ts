import type { ReceiptData } from "../core/receipt-generator.js";

export function getPrinterLocaleWarning(data: ReceiptData): string | undefined {
  if (!["ko", "ja", "zh"].includes(data.config.locale || "")) return undefined;

  return "Localized printer output requires a printer/driver that supports UTF-8 or the target language code page. If the printed text is garbled, use HTML output or configure the printer's text encoding support.";
}
