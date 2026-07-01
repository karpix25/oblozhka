import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export async function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = await readFile(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

export function derivePublicStorageUrl() {
  if (process.env.S3_PUBLIC_BASE_URL || !process.env.S3_ENDPOINT || !process.env.S3_BUCKET) return;
  process.env.S3_PUBLIC_BASE_URL = `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${process.env.S3_BUCKET}`;
}

export function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (key && value) parsed[key] = value;
  }
  return parsed;
}

export function contentTypeFor(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
