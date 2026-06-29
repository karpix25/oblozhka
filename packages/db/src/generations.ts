import { generationDebit, type ProjectPlatform, type WizardInput } from "@covers/domain";
import type { DbClient } from "./client.js";
import { mutateCredits, mutateCreditsInTransaction } from "./credits.js";

export async function createGeneration(
  db: DbClient,
  input: { userId: string; wizard: WizardInput; prompt: string; chargeCredits?: boolean }
) {
  return db.$transaction(async (tx) => {
    const creditCost = input.chargeCredits ? 1 : 0;
    const generation = await tx.generation.create({
      data: {
        userId: input.userId,
        format: input.wizard.format,
        referenceMode: input.wizard.referenceMode,
        referenceImageUrl: input.wizard.referenceImageUrl,
        topic: input.wizard.topic,
        hookText: input.wizard.hookText,
        niche: input.wizard.niche,
        style: input.wizard.style,
        prompt: input.prompt,
        creditCost
      }
    });

    if (generation.creditCost > 0) {
      await mutateCreditsInTransaction(tx, {
        userId: input.userId,
        amount: generationDebit(generation.creditCost),
        reason: "GENERATION_DEBIT",
        referenceId: generation.id,
        note: "Image generation"
      });
    }

    return generation;
  });
}

export async function createGenerationFromProject(
  db: DbClient,
  input: { projectId: string; userId: string; referenceImageUrl: string; chargeCredits?: boolean }
) {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUniqueOrThrow({
      where: { id: input.projectId },
      include: {
        selectedHook: true,
        selectedTemplate: true,
        transcripts: true,
        sourceAssets: true
      }
    });

    if (!project.selectedHook || !project.selectedTemplate || !project.platform) {
      throw new Error("Project must have platform, template and selected hook before generation.");
    }

    const format = formatForPlatform(project.platform);
    const topic = project.topicSummary ?? project.transcripts[0]?.cleanText ?? project.transcripts[0]?.rawText ?? "Обложка по ролику";
    const creditCost = input.chargeCredits ? 1 : 0;
    const generation = await tx.generation.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        templateId: project.selectedTemplate.id,
        hookCandidateId: project.selectedHook.id,
        platform: project.platform,
        format,
        referenceMode: project.platform === "FACELESS" ? "REFERENCE" : "FACE",
        referenceImageUrl: input.referenceImageUrl,
        topic,
        hookText: project.selectedHook.text,
        niche: project.platform,
        style: project.selectedTemplate.title,
        prompt: "Prompt will be planned by OpenRouter in the worker.",
        creditCost
      }
    });

    if (generation.creditCost > 0) {
      await mutateCreditsInTransaction(tx, {
        userId: input.userId,
        amount: generationDebit(generation.creditCost),
        reason: "GENERATION_DEBIT",
        referenceId: generation.id,
        note: "Project thumbnail generation"
      });
    }

    await tx.project.update({
      where: { id: input.projectId },
      data: { status: "GENERATION_PENDING" }
    });

    return generation;
  });
}

function formatForPlatform(platform: ProjectPlatform) {
  return platform === "YOUTUBE" ? "YOUTUBE" : "VERTICAL";
}

export async function markGenerationProcessing(db: DbClient, id: string) {
  return db.generation.update({
    where: { id },
    data: { status: "PROCESSING" }
  });
}

export async function updateGenerationPrompt(
  db: DbClient,
  id: string,
  data: { prompt: string; referenceAnalysis?: string; providerMeta?: object }
) {
  return db.generation.update({
    where: { id },
    data
  });
}

export async function markGenerationSucceeded(
  db: DbClient,
  id: string,
  data: { originalUrl: string; previewUrl: string; providerMeta?: object }
) {
  return db.generation.update({
    where: { id },
    data: { status: "SUCCEEDED", ...data }
  });
}

export async function markGenerationFailed(db: DbClient, id: string, errorMessage: string) {
  const generation = await db.generation.update({
    where: { id },
    data: { status: "FAILED", errorMessage }
  });

  if (generation.creditCost > 0) {
    await mutateCredits(db, {
      userId: generation.userId,
      amount: generation.creditCost,
      reason: "GENERATION_REFUND",
      referenceId: generation.id,
      note: "Generation failed"
    });
  }

  return generation;
}

export async function findGeneration(db: DbClient, id: string) {
  return db.generation.findUnique({ where: { id }, include: { user: true } });
}

export async function listGenerations(db: DbClient) {
  return db.generation.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}
