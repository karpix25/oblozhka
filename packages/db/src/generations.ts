import {
  getModernizationAction,
  type ModernizationActionId,
  type WizardInput
} from "@covers/domain";
import { serializeAdminUser } from "./adminSerializers.js";
import type { DbClient } from "./client.js";
import { debitGenerationCreditInTransaction, refundGenerationCreditInTransaction } from "./credits.js";
import { generationBillingData } from "./generationBilling.js";

export { createGenerationFromProject } from "./projectGenerations.js";

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
      const { access } = await debitGenerationCreditInTransaction(tx, {
        userId: input.userId,
        amount: generation.creditCost,
        referenceId: generation.id,
        note: "Image generation"
      });
      await tx.generation.update({
        where: { id: generation.id },
        data: generationBillingData(access)
      });
    }

    return tx.generation.findUniqueOrThrow({ where: { id: generation.id } });
  });
}

export async function createModernizedGeneration(
  db: DbClient,
  input: { sourceGenerationId: string; userId: string; actionId: ModernizationActionId; userInstruction: string; chargeOnSuccess?: boolean }
) {
  return db.$transaction(async (tx) => {
    const action = getModernizationAction(input.actionId);
    if (!action) {
      throw new Error("Unknown modernization action.");
    }

    const source = await tx.generation.findUniqueOrThrow({ where: { id: input.sourceGenerationId } });
    if (source.userId !== input.userId) {
      throw new Error("Generation does not belong to this user.");
    }
    if (source.status !== "SUCCEEDED" || !source.originalUrl) {
      throw new Error("Generation is not ready for modernization.");
    }

    const generation = await tx.generation.create({
      data: {
        userId: source.userId,
        projectId: source.projectId,
        templateId: source.templateId,
        userStyleAssetId: source.userStyleAssetId,
        styleSource: source.styleSource,
        hookCandidateId: source.hookCandidateId,
        platform: source.platform,
        format: source.format,
        referenceMode: "REFERENCE",
        referenceImageUrl: source.originalUrl,
        guestFaceAssetId: source.guestFaceAssetId,
        guestReferenceImageUrl: source.guestReferenceImageUrl,
        topic: `Изменить готовую обложку. Пользователь просит: ${input.userInstruction}`,
        hookText: source.hookText,
        niche: source.niche,
        style: `Сохрани основу готовой обложки. ${action.promptInstruction} User edit request: ${input.userInstruction}`,
        prompt: "Prompt will be planned by OpenRouter in the worker.",
        creditCost: 0,
        providerMeta: {
          modernization: {
            sourceGenerationId: source.id,
            actionId: action.id,
            userInstruction: input.userInstruction,
            chargeOnSuccess: Boolean(input.chargeOnSuccess)
          }
        }
      }
    });

    if (source.projectId) {
      await tx.project.update({
        where: { id: source.projectId },
        data: { status: "GENERATION_PENDING" }
      });
    }

    return tx.generation.findUniqueOrThrow({ where: { id: generation.id } });
  });
}

export async function chargeGenerationCreditOnSuccess(db: DbClient, id: string, note: string) {
  return db.$transaction(async (tx) => {
    const generation = await tx.generation.findUniqueOrThrow({ where: { id } });
    if (generation.creditCost > 0) {
      return generation;
    }

    const existingDebit = await tx.creditLedgerEntry.findFirst({
      where: {
        userId: generation.userId,
        reason: "GENERATION_DEBIT",
        referenceId: generation.id
      }
    });
    if (existingDebit) {
      return generation;
    }

    const { access } = await debitGenerationCreditInTransaction(tx, {
      userId: generation.userId,
      amount: 1,
      referenceId: generation.id,
      note
    });

    return tx.generation.update({
      where: { id: generation.id },
      data: {
        creditCost: 1,
        ...generationBillingData(access)
      }
    });
  });
}

export async function markGenerationProcessing(db: DbClient, id: string) {
  return db.$transaction(async (tx) => {
    await tx.generation.updateMany({
      where: { id, startedAt: null },
      data: { startedAt: new Date() }
    });
    return tx.generation.update({
      where: { id },
      data: { status: "PROCESSING" }
    });
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
    data: { status: "SUCCEEDED", finishedAt: new Date(), ...data }
  });
}

export async function markGenerationFailed(db: DbClient, id: string, errorMessage: string) {
  try {
    return await db.$transaction(async (tx) => {
      const generation = await tx.generation.update({
      where: { id },
      data: { status: "FAILED", errorMessage, finishedAt: new Date() }
      });

    const existingRefund = await tx.creditLedgerEntry.findFirst({
      where: {
        userId: generation.userId,
        reason: "GENERATION_REFUND",
        referenceId: generation.id
      }
    });

    if (generation.creditCost > 0 && !existingRefund) {
      await refundGenerationCreditInTransaction(tx, {
        userId: generation.userId,
        amount: generation.creditCost,
        referenceId: generation.id,
        chargedSubscriptionId: generation.chargedSubscriptionId,
        note: "Generation failed"
      });
    }

      return generation;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      return db.generation.findUniqueOrThrow({ where: { id } });
    }
    throw error;
  }
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function findGeneration(db: DbClient, id: string) {
  return db.generation.findUnique({
    where: { id },
    include: {
      user: true,
      guestFaceAsset: true,
      template: true,
      userStyleAsset: true,
      project: {
        include: {
          transcripts: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      }
    }
  });
}

export async function listGenerations(db: DbClient) {
  const generations = await db.generation.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return generations.map((generation) => ({
    ...generation,
    user: serializeAdminUser(generation.user)
  }));
}

export async function listUserSucceededGenerations(db: DbClient, input: { userId: string; take?: number }) {
  return db.generation.findMany({
    where: {
      userId: input.userId,
      status: "SUCCEEDED",
      previewUrl: { not: null },
      originalUrl: { not: null }
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 20,
    include: { template: true, userStyleAsset: true }
  });
}
