import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function templatePreviewPath(repoRoot, slug) {
  return join(repoRoot, "apps", "bot", "assets", "templates", `${slug}.png`);
}

export async function uploadLocalFile(storage, input) {
  const body = await readFile(input.path);
  const url = await storage.uploadBuffer({
    key: input.key,
    body,
    contentType: input.contentType
  });
  if (!url.startsWith("https://")) {
    throw new Error(`Storage URL must be public HTTPS for local Kie test: ${url}`);
  }
  return url;
}
