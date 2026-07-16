import chalk from "chalk";
import prompts from "prompts";
import { ConfigManager } from "../core/config-manager.js";
import type { ReceiptConfig } from "../types/config.js";

export interface SetupOptions {
  uninstall?: boolean;
}

export class SetupCommand {
  private configManager = new ConfigManager();

  async execute(options: SetupOptions): Promise<void> {
    console.log(chalk.cyan.bold("\nCodex Receipts Setup\n"));

    if (options.uninstall) {
      await this.configManager.resetConfig();
      console.log(chalk.green("Configuration reset."));
      return;
    }

    const answers = await prompts([
      {
        type: "text",
        name: "location",
        message: "Default location (leave blank for The Cloud):",
        initial: "",
      },
      {
        type: "text",
        name: "timezone",
        message: "Timezone (leave blank for system default):",
        initial: "",
      },
    ]);

    if (answers.location === undefined || answers.timezone === undefined) {
      console.log(chalk.yellow("\nSetup cancelled"));
      return;
    }

    const config: ReceiptConfig = {
      version: "1.0.0",
      location: answers.location || undefined,
      timezone: answers.timezone || undefined,
    };

    await this.configManager.saveConfig(config);

    console.log(chalk.green("\nSetup complete"));
    console.log(chalk.gray(`Config file: ${this.configManager.getConfigPath()}`));
    console.log("");
    console.log(chalk.cyan("Generate a receipt anytime with:"));
    console.log(chalk.bold("  npx codex-receipts generate --output html"));
    console.log("");
    console.log(
      chalk.gray(
        "Codex logs are read from ~/.codex/session_index.jsonl and ~/.codex/sessions/**.",
      ),
    );
  }
}
