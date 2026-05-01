#!/usr/bin/env node

import { Command, Option } from "commander";
import { GenerateCommand } from "./commands/generate.js";
import { ConfigCommand } from "./commands/config.js";
import { SetupCommand } from "./commands/setup.js";

const program = new Command();

program
  .name("codex-receipts")
  .description("Generate quirky receipts for your Codex work sessions")
  .version("1.1.0");

// Generate command
program
  .command("generate")
  .description("Generate a receipt for a Codex session")
  .option("-s, --session <id>", "Specific session ID to generate receipt for")
  .addOption(
    new Option("-o, --output <format...>", "Output format(s): html, console, printer (comma-separated or repeated)")
      .argParser((value: string, prev: string[] | undefined) => {
        const formats = value.split(",").map((s) => s.trim()).filter(Boolean);
        const valid = ["html", "console", "printer"];
        for (const f of formats) {
          if (!valid.includes(f)) {
            throw new Error(`Invalid output format "${f}". Valid formats: ${valid.join(", ")}`);
          }
        }
        return [...(prev || []), ...formats];
      }),
  )
  .option("-l, --location <text>", "Override location detection")
  .option(
    "-p, --printer <interface>",
    'Printer: "usb" (auto-detect), "usb:VID:PID", "tcp://host:port", or CUPS name',
  )
  .action(async (options) => {
    const command = new GenerateCommand();
    await command.execute(options);
  });

// Config command
program
  .command("config")
  .description("Manage configuration")
  .option("--show", "Display current configuration")
  .option("--set <key=value>", "Set a configuration value")
  .option("--reset", "Reset configuration to defaults")
  .action(async (options) => {
    const command = new ConfigCommand();
    await command.execute(options);
  });

// Setup command
program
  .command("setup")
  .description("Create or reset Codex Receipts configuration")
  .option("--uninstall", "Reset Codex Receipts configuration")
  .action(async (options) => {
    const command = new SetupCommand();
    await command.execute(options);
  });

// Make generate the default command if no command is specified
if (process.argv.length === 2) {
  process.argv.push("generate");
}

program.parse();
