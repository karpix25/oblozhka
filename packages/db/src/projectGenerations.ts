import {
  assertTemplateCompatibleWithPlatform,
  designRequiresGuestFace,
  type ProjectPlatform
} from "@covers/domain";
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";
import { debitGenerationCreditInTransaction } from "./credits.js";
import { generationBillingData } from "./generationBilling.js";

export async function createGenerationFromProject(
  db: DbClient,
  input: {
    projectId: string;
    userId: string;
    referenceImageUrl: string;
    chargeCredits?: boolean;
    requestKey?: string;
  }
) {
  try {
    return await withSerializableRetry(db, async (tx) => {
      if (input.requestKey) {
        const existingRequest = await tx.generation.findUnique({ where: { requestKey: input.requestKey } });
        if (existingRequest) {
          if (existingRequest.userId !== input.userId) {
            throw new Error("Generation request does not belong to this user.");
          }
          return existingRequest;
        }
      }

      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        include: {
          selectedHook: true,
          selectedTemplate: true,
          selectedUserStyleAsset: true,
          guestFaceAsset: true,
          transcripts: true,
          sourceAssets: true
        }
      });

      assertProjectReady(project, input.userId);
      const activeGenerations = await tx.generation.findMany({
        where: { projectId: input.projectId, status: { in: ["QUEUED", "PROCESSING"] } },
        orderBy: { createdAt: "asc" }
      });
      const existingPrimary = activeGenerations.find(isPrimaryProjectGeneration);
      if (existingPrimary) return existingPrimary;

      const generation = await tx.generation.create({
        data: projectGenerationData(project, input)
      });
      if (generation.creditCost > 0) {
        const { access } = await debitGenerationCreditInTransaction(tx, {
          userId: input.userId,
          amount: generation.creditCost,
          referenceId: generation.id,
          note: "Project thumbnail generation"
        });
        await tx.generation.update({
          where: { id: generation.id },
          data: generationBillingData(access)
        });
      }
      await tx.project.update({
        where: { id: input.projectId },
        data: { status: "GENERATION_PENDING" }
      });
      return tx.generation.findUniqueOrThrow({ where: { id: generation.id } });
    });
  } catch (error) {
    if (input.requestKey && isUniqueConflict(error)) {
      const existing = await db.generation.findUnique({ where: { requestKey: input.requestKey } });
      if (existing?.userId === input.userId && existing.projectId === input.projectId) return existing;
    }
    throw error;
  }
}

type ProjectForGeneration = Prisma.ProjectGetPayload<{
  include: {
    selectedHook: true;
    selectedTemplate: true;
    selectedUserStyleAsset: true;
    guestFaceAsset: true;
    transcripts: true;
    sourceAssets: true;
  };
}>;

type ReadyProject = ProjectForGeneration & {
  selectedHook: { id: string; text: string };
  platform: ProjectPlatform;
};

function assertProjectReady(project: ProjectForGeneration, userId: string): asserts project is ReadyProject {
  if (!project.selectedHook || !project.platform || (!project.selectedTemplate && !project.selectedUserStyleAsset)) {
    throw new Error("Project must have platform, style/template and selected hook before generation.");
  }
  if (project.userId !== userId) throw new Error("Project does not belong to this user.");
  if (project.selectedTemplate) assertTemplateCompatibleWithPlatform(project.platform, project.selectedTemplate);
  if (designRequiresGuestFace(project.selectedTemplate) && !project.guestFaceAsset) {
    throw new Error("This template requires a second face reference.");
  }
}

function projectGenerationData(project: ReadyProject, input: {
  projectId: string;
  userId: string;
  referenceImageUrl: string;
  chargeCredits?: boolean;
  requestKey?: string;
}) {
  const topic = project.topicSummary ?? project.transcripts[0]?.cleanText ?? project.transcripts[0]?.rawText ?? "Обложка по ролику";
  return {
    requestKey: input.requestKey,
    userId: input.userId,
    projectId: input.projectId,
    templateId: project.selectedTemplate?.id,
    userStyleAssetId: project.selectedUserStyleAsset?.id,
    styleSource: project.styleSource,
    hookCandidateId: project.selectedHook.id,
    platform: project.platform,
    format: formatForPlatform(project.platform),
    referenceMode: project.platform === "FACELESS" ? "REFERENCE" as const : "FACE" as const,
    referenceImageUrl: input.referenceImageUrl,
    guestFaceAssetId: project.guestFaceAssetId,
    guestReferenceImageUrl: project.guestFaceAsset?.imageUrl,
    topic,
    hookText: project.selectedHook.text,
    niche: project.platform,
    style: project.selectedTemplate?.title ?? project.selectedUserStyleAsset?.title ?? "Пользовательский стиль",
    prompt: "Prompt will be planned by OpenRouter in the worker.",
    creditCost: input.chargeCredits ? 1 : 0
  };
}

function isPrimaryProjectGeneration(generation: { providerMeta: unknown }) {
  const meta = generation.providerMeta;
  return !meta || typeof meta !== "object" || !("modernization" in meta);
}

async function withSerializableRetry<T>(db: DbClient, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isTransactionConflict(error) || attempt === 3) throw error;
    }
  }
  throw new Error("Serializable transaction retry limit exceeded.");
}

function formatForPlatform(platform: ProjectPlatform) {
  return platform === "YOUTUBE" ? "YOUTUBE" as const : "VERTICAL" as const;
}

function isTransactionConflict(error: unknown) {
  return errorCode(error) === "P2034";
}

function isUniqueConflict(error: unknown) {
  return errorCode(error) === "P2002";
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}
