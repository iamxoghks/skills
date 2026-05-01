/**
 * ASCII art headers for receipts
 */

export const CODEX_LOGO = `     ▐▛███▜▌
    ▝▜█████▛▘
      ▘▘ ▝▝   `;

/**
 * Get the Codex receipt logo
 */
export function getHeader(): string {
  return CODEX_LOGO;
}

/**
 * Receipt section separators
 */
export const SEPARATOR = "━".repeat(35);
export const LIGHT_SEPARATOR = "─".repeat(35);
