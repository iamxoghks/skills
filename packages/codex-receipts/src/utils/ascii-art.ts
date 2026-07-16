/**
 * ASCII art headers for receipts
 */

export const CODEX_APP_LOGO = [
  "      ████",
  "     █████████",
  "    ███████████",
  "   █████████████",
  "  ██████████████",
  " ████ ██████████",
  " █████ █████████",
  " █████  █████████",
  " █████  █████████",
  "  ████ ██████████",
  "  ███ ████   ████",
  "  ██████████████",
  "  █████████████",
  "   ███████████",
  "    █████████",
  "        ████",
].join("\n");

/**
 * Get the Codex receipt logo
 */
export function getHeader(): string {
  return CODEX_APP_LOGO;
}

/**
 * Receipt section separators
 */
export const SEPARATOR = "━".repeat(35);
export const LIGHT_SEPARATOR = "─".repeat(35);
