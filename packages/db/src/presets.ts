import type { DbClient } from "./client.js";

export type PromptPresetInput = {
  slug: string;
  title: string;
  niche: string;
  style: string;
  promptTemplate: string;
  isActive?: boolean;
};

export async function listPromptPresets(db: DbClient) {
  return db.promptPreset.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function listActivePromptPresets(db: DbClient) {
  return db.promptPreset.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" }
  });
}

export async function createPromptPreset(db: DbClient, input: PromptPresetInput) {
  return db.promptPreset.create({
    data: { ...input, isActive: input.isActive ?? true }
  });
}

export async function updatePromptPreset(db: DbClient, id: string, input: Partial<PromptPresetInput>) {
  return db.promptPreset.update({
    where: { id },
    data: input
  });
}
