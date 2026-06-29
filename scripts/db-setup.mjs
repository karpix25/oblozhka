import { spawn } from "node:child_process";
import { buildDatabaseUrl, isEnabled, maskDatabaseUrl } from "./shared-database-url.mjs";

const databaseUrl = !process.env.DATABASE_URL?.trim()
  ? buildDatabaseUrl(process.env)
  : process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const acceptDataLoss = isEnabled(process.env.PRISMA_DB_PUSH_ACCEPT_DATA_LOSS);
const args = ["run", "prisma:push"];

if (acceptDataLoss) {
  args.push("--", "--accept-data-loss");
}

console.log(`db-setup: applying Prisma schema to ${maskDatabaseUrl(databaseUrl)}`);
console.log(`db-setup: accept data loss = ${acceptDataLoss ? "true" : "false"}`);

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
