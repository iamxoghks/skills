import type { ReceiptConfig } from "../types/config.js";

export class LocationDetector {
  /**
   * Get location string from config or a neutral fallback.
   */
  async getLocation(config: ReceiptConfig): Promise<string> {
    if (config.location) {
      return config.location;
    }

    return "The Cloud";
  }
}
