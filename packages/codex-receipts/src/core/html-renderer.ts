import type { ReceiptData } from "./receipt-generator.js";
import { formatNumber, formatDateTime } from "../utils/formatting.js";
import { getReceiptLabels } from "../utils/locale.js";
import { getReceiptTextOptions } from "../utils/receipt-text.js";

export class HtmlRenderer {
  /**
   * Generate HTML receipt with embedded CSS
   */
  generateHtml(data: ReceiptData, receiptText: string): string {
    const labels = getReceiptLabels(data.config.locale);
    const textOptions = getReceiptTextOptions(data.config, labels);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codex Receipt - ${this.escapeHtml(data.transcriptData.sessionSlug)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 16px;
      background: #3a3a3a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .receipt-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
    }

    .receipt {
      background: #f8f8f8;
      width: 400px;
      padding: 30px 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      position: relative;
      animation: slideIn 0.5s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .receipt::before,
    .receipt::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 15px;
      background: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 10px,
        #f8f8f8 10px,
        #f8f8f8 20px
      );
    }

    .receipt::before {
      top: -15px;
      left: -10px;
    }

    .receipt::after {
      bottom: -15px;
    }

    .receipt-content {
      color: #333;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .header {
      text-align: center;
      padding: 20px 0;
    }

    .logo {
      display: inline-block;
      width: 86px;
      height: 86px;
      margin: 8px 0 14px;
      color: #111;
    }

    .logo svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .separator {
      border-bottom: 2px solid #333;
      margin: 15px 0;
    }

    .light-separator {
      border-bottom: 1px dashed #999;
      margin: 10px 0;
    }

    .summary {
      background: #fff;
      padding: 15px;
      margin: 15px 0;
      border-left: 4px solid #333;
    }

    .line-item {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      color: #555;
    }

    .model-header {
      display: flex;
      justify-content: space-between;
      padding: 8px 0 4px 0;
      margin-top: 10px;
      border-bottom: 1px dashed #ccc;
    }

    .model-header:first-child {
      margin-top: 0;
    }

    .model-name {
      font-weight: bold;
      color: #333;
    }

    .model-cost {
      font-weight: bold;
      color: #333;
    }

    .total-section {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px solid #333;
    }

    .total {
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      margin: 10px 0;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px dashed #999;
      color: #666;
    }

    .footer-message {
      margin: 15px 0;
      color: #333;
    }

    .meta {
      margin: 10px 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .meta-row {
      color: #666;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 1px;
      text-align: left;
    }

    .meta .dots {
      overflow: hidden;
      text-wrap: auto;
      word-wrap: break-word;
      height: 1rem;
    }

    .meta .value {
      text-align: right;
    }

    .download-link {
      text-align: center;
      margin-top: 20px;
    }

    .download-link a {
      display: inline-block;
      padding: 10px 20px;
      background: #333;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      transition: background 0.3s;
    }

    .download-link a:hover {
      background: #000;
    }

    .generated-by {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px dashed #999;
    }

    @media print {
      body {
        background: white;
      }
      .receipt {
        box-shadow: none;
        width: 100%;
      }
      .download-link {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="receipt">
      <div class="header">
        <div class="logo" aria-label="Codex logo">
          <svg viewBox="0 0 36 36" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
            <g fill="currentColor"><rect x="12" y="2" width="8" height="1"/><rect x="11" y="3" width="10" height="1"/><rect x="9" y="4" width="18" height="1"/><rect x="9" y="5" width="20" height="1"/><rect x="8" y="6" width="22" height="1"/><rect x="7" y="7" width="24" height="1"/><rect x="6" y="8" width="25" height="1"/><rect x="4" y="9" width="28" height="1"/><rect x="4" y="10" width="28" height="1"/><rect x="3" y="11" width="29" height="1"/><rect x="2" y="12" width="8" height="1"/><rect x="13" y="12" width="19" height="1"/><rect x="2" y="13" width="8" height="1"/><rect x="13" y="13" width="19" height="1"/><rect x="2" y="14" width="9" height="1"/><rect x="14" y="14" width="18" height="1"/><rect x="2" y="15" width="9" height="1"/><rect x="15" y="15" width="18" height="1"/><rect x="2" y="16" width="10" height="1"/><rect x="15" y="16" width="19" height="1"/><rect x="2" y="17" width="10" height="1"/><rect x="16" y="17" width="18" height="1"/><rect x="2" y="18" width="10" height="1"/><rect x="15" y="18" width="19" height="1"/><rect x="2" y="19" width="10" height="1"/><rect x="15" y="19" width="19" height="1"/><rect x="3" y="20" width="8" height="1"/><rect x="14" y="20" width="20" height="1"/><rect x="4" y="21" width="6" height="1"/><rect x="14" y="21" width="5" height="1"/><rect x="27" y="21" width="7" height="1"/><rect x="4" y="22" width="6" height="1"/><rect x="13" y="22" width="6" height="1"/><rect x="27" y="22" width="7" height="1"/><rect x="4" y="23" width="6" height="1"/><rect x="12" y="23" width="7" height="1"/><rect x="27" y="23" width="7" height="1"/><rect x="4" y="24" width="29" height="1"/><rect x="4" y="25" width="28" height="1"/><rect x="4" y="26" width="28" height="1"/><rect x="5" y="27" width="25" height="1"/><rect x="5" y="28" width="24" height="1"/><rect x="6" y="29" width="22" height="1"/><rect x="7" y="30" width="20" height="1"/><rect x="9" y="31" width="18" height="1"/><rect x="15" y="32" width="10" height="1"/><rect x="16" y="33" width="8" height="1"/></g>
          </svg>
        </div>
        <div class="meta">
          <div class="meta-row">
            <div>${this.escapeHtml(labels.location)}</div><div class="dots">....................</div><div class="value">${this.escapeHtml(data.location)}</div>
          </div>
          <div class="meta-row">
            <div>${this.escapeHtml(labels.session)}</div><div class="dots">....................</div><div class="value">${this.escapeHtml(data.transcriptData.sessionSlug)}</div>
          </div>
          <div class="meta-row">
            <div>${this.escapeHtml(labels.date)}</div><div class="dots">....................</div><div class="value">${formatDateTime(data.transcriptData.endTime, data.config.timezone)}</div>
          </div>
        </div>
      </div>

      <div class="separator"></div>

      ${this.renderLineItems(data)}

      <div class="total-section">
        <div class="total">
          <span>${this.escapeHtml(labels.total)}</span>
          <span>${this.formatPoints(data.sessionData.totalCost)}</span>
        </div>
      </div>

      <div class="footer">
        <div>${this.escapeHtml(textOptions.cashierLabel)}: ${this.escapeHtml(textOptions.cashier || this.getMainModel(data))}</div>
        <div class="footer-message">${this.escapeHtml(textOptions.footerMessage)}</div>
        <div class="generated-by">
          ${this.escapeHtml(labels.generatedBy)} <strong>Codex receipts</strong><br>
          <a href="https://github.com/iamxoghks/skills/tree/main/packages/codex-receipts" style="color: #333;">github.com/iamxoghks/skills</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Add keyboard shortcut to close window
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });

    console.log('Codex Receipt Generated!');
    console.log('Press ESC to close');
  </script>
</body>
</html>`;
  }

  /**
   * Render line items HTML
   * Shows Codex work counters and model subtotals.
   */
  private renderLineItems(data: ReceiptData): string {
    const labels = getReceiptLabels(data.config.locale);
    let html = '<div style="margin: 20px 0;">';

    if (
      data.sessionData.modelBreakdowns &&
      data.sessionData.modelBreakdowns.length > 0
    ) {
      for (const model of data.sessionData.modelBreakdowns) {
        html += `<div class="model-header">
          <span class="model-name">${this.escapeHtml(this.getModelName(model.modelName, labels))}</span>
          <span class="model-cost">${this.formatPoints(model.cost)}</span>
        </div>`;

        html += `<div class="line-item">
          <span>  ${this.escapeHtml(labels.input)}</span>
          <span>${formatNumber(model.inputTokens)}</span>
        </div>`;

        html += `<div class="line-item">
          <span>  ${this.escapeHtml(labels.output)}</span>
          <span>${formatNumber(model.outputTokens)}</span>
        </div>`;

        if (model.cacheCreationTokens && model.cacheCreationTokens > 0) {
          html += `<div class="line-item">
            <span>  ${this.escapeHtml(labels.reasoning)}</span>
            <span>${formatNumber(model.cacheCreationTokens)}</span>
          </div>`;
        }

        if (model.cacheReadTokens && model.cacheReadTokens > 0) {
          html += `<div class="line-item">
            <span>  ${this.escapeHtml(labels.cached)}</span>
            <span>${formatNumber(model.cacheReadTokens)}</span>
          </div>`;
        }
      }
    }

    html += "</div>";
    return html;
  }

  /**
   * Get clean model name
   */
  private getModelName(model: string, labels?: ReturnType<typeof getReceiptLabels>): string {
    const localized = labels?.breakdowns[model];
    if (localized) return localized;

    return model
      .replace(/^gpt-/, "GPT-")
      .replace(/^codex$/, "Codex")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Get main model
   */
  private getMainModel(data: ReceiptData): string {
    if (data.sessionData.modelsUsed && data.sessionData.modelsUsed.length > 0) {
      return this.getModelName(data.sessionData.modelsUsed[0]);
    }

    if (
      data.sessionData.modelBreakdowns &&
      data.sessionData.modelBreakdowns.length > 0
    ) {
      return this.getModelName(data.sessionData.modelBreakdowns[0].modelName);
    }

    return "Codex";
  }

  private formatPoints(points: number): string {
    return `${formatNumber(Math.round(points))} pts`;
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
