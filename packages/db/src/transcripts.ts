import type { DbClient } from "./client.js";

export async function upsertProjectTranscript(
  db: DbClient,
  input: { projectId: string; rawText: string; cleanText?: string; language?: string; providerMeta?: object }
) {
  const existing = await db.transcript.findFirst({
    where: { projectId: input.projectId },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    return db.transcript.update({
      where: { id: existing.id },
      data: {
        rawText: input.rawText,
        cleanText: input.cleanText,
        language: input.language,
        providerMeta: input.providerMeta
      }
    });
  }

  return db.transcript.create({
    data: {
      projectId: input.projectId,
      rawText: input.rawText,
      cleanText: input.cleanText,
      language: input.language,
      providerMeta: input.providerMeta
    }
  });
}
