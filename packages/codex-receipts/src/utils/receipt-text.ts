import type { ReceiptConfig } from "../types/config.js";
import type { ReceiptLabels } from "./locale.js";

export interface ReceiptTextOptions {
  cashierLabel: string;
  cashier?: string;
  footerMessage: string;
}

export function getReceiptTextOptions(
  config: ReceiptConfig,
  labels: ReceiptLabels,
): ReceiptTextOptions {
  return {
    cashierLabel: config.cashierLabel || labels.cashier,
    cashier: config.cashier,
    footerMessage: config.footerMessage || labels.footerMessage,
  };
}
