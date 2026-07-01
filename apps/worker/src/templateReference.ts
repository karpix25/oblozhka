import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ObjectStorage } from "@covers/storage";

export type TemplateReferenceInput = {
  generationId: string;
  templateSlug?: string | null;
  storage: ObjectStorage;
};

export async function prepareTemplateReferenceUrl(input: TemplateReferenceInput) {
  if (!input.templateSlug || !hasPublicHttpsStorage()) return undefined;

  const path = findTemplatePreviewPath(input.templateSlug);
  if (!path) return undefined;

  try {
    const body = await readFile(path);
    const url = await input.storage.uploadBuffer({
      key: `template-references/${input.generationId}/${input.templateSlug}.png`,
      body,
      contentType: "image/png"
    });
    return url.startsWith("https://") ? url : undefined;
  } catch (error) {
    console.warn("Template reference preview upload failed; continuing without visual template reference.", {
      generationId: input.generationId,
      templateSlug: input.templateSlug,
      error
    });
    return undefined;
  }
}

function hasPublicHttpsStorage() {
  return Boolean(process.env.S3_PUBLIC_BASE_URL?.startsWith("https://"));
}

function findTemplatePreviewPath(slug: string) {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "apps", "bot", "assets", "templates", `${slug}.png`),
    join(currentDir, "..", "..", "bot", "assets", "templates", `${slug}.png`),
    join(currentDir, "..", "..", "..", "apps", "bot", "assets", "templates", `${slug}.png`)
  ];
  return candidates.find((candidate) => existsSync(candidate));
}
