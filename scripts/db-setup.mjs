import { spawn } from "node:child_process";
import { buildDatabaseUrl, isEnabled, maskDatabaseUrl } from "./shared-database-url.mjs";

const SETUP_MODES = new Set(["migrate", "push"]);

const databaseUrl = !process.env.DATABASE_URL?.trim()
  ? buildDatabaseUrl(process.env)
  : process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const setupMode = getSetupMode(process.env.PRISMA_DB_SETUP_MODE);
const args = getPrismaArgs(setupMode);

console.log(`db-setup: applying Prisma schema to ${maskDatabaseUrl(databaseUrl)}`);
console.log(`db-setup: mode = ${setupMode}`);

const child = spawn("npm", args, {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`db-setup: prisma exited by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

function getSetupMode(value) {
  const mode = String(value || "migrate").trim().toLowerCase();

  if (!SETUP_MODES.has(mode)) {
    console.error(`db-setup: unsupported PRISMA_DB_SETUP_MODE "${value}". Use "migrate" or "push".`);
    process.exit(1);
  }

  return mode;
}

function getPrismaArgs(mode) {
  if (mode === "migrate") {
    return ["run", "prisma:migrate:deploy"];
  }

  const args = ["run", "prisma:push"];

  if (isEnabled(process.env.PRISMA_DB_PUSH_ACCEPT_DATA_LOSS)) {
    args.push("--", "--accept-data-loss");
    console.warn("db-setup: PRISMA_DB_PUSH_ACCEPT_DATA_LOSS is enabled for db push");
  }

  return args;
}
