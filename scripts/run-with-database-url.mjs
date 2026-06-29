import { spawn } from "node:child_process";
import { buildDatabaseUrl, isEnabled, maskDatabaseUrl } from "./shared-database-url.mjs";

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error("run-with-database-url: command is required.");
  process.exit(1);
}

if (isEnabled(process.env.DATABASE_URL_FROM_POSTGRES_PARTS) || !process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = buildDatabaseUrl(process.env);
}

console.log(`database: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);

const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`run-with-database-url: command exited by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
