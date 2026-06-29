import type { ProjectPlatform, SourceType } from "@covers/domain";
import type { DbClient } from "./client.js";

export type CreateProjectInput = {
  userId: string;
  sourceType: SourceType;
  source: {
    url?: string;
    text?: string;
    fileId?: string;
    mimeType?: string;
    previewImageUrl?: string;
    metadata?: object;
  };
};

export async function createProject(db: DbClient, input: CreateProjectInput) {
  return db.project.create({
    data: {
      userId: input.userId,
      sourceType: input.sourceType,
      status: "SOURCE_READY",
      sourceAssets: {
        create: {
          type: input.sourceType,
          url: input.source.url,
          text: input.source.text,
          fileId: input.source.fileId,
          mimeType: input.source.mimeType,
          previewImageUrl: input.source.previewImageUrl,
          metadata: input.source.metadata
        }
      },
      transcripts: input.source.text
        ? { create: { rawText: input.source.text } }
        : undefined
    },
    include: { sourceAssets: true, transcripts: true }
  });
}

export async function setProjectPlatform(db: DbClient, projectId: string, platform: ProjectPlatform) {
  return db.project.update({
    where: { id: projectId },
    data: { platform },
    include: { sourceAssets: true, transcripts: true }
  });
}

export async function setProjectTemplate(db: DbClient, projectId: string, templateId: string) {
  return db.project.update({
    where: { id: projectId },
    data: { selectedTemplateId: templateId },
    include: { selectedTemplate: true, sourceAssets: true, transcripts: true }
  });
}

export async function setProjectGuestFaceAsset(db: DbClient, projectId: string, guestFaceAssetId: string) {
  return db.project.update({
    where: { id: projectId },
    data: { guestFaceAssetId },
    include: { guestFaceAsset: true, selectedTemplate: true }
  });
}

export async function selectProjectHook(db: DbClient, projectId: string, hookId: string) {
  return db.$transaction(async (tx) => {
    await tx.hookCandidate.updateMany({
      where: { projectId },
      data: { isSelected: false }
    });
    await tx.hookCandidate.update({
      where: { id: hookId },
      data: { isSelected: true }
    });
    return tx.project.update({
      where: { id: projectId },
      data: { selectedHookId: hookId },
      include: {
        selectedHook: true,
        selectedTemplate: true,
        sourceAssets: true,
        transcripts: true
      }
    });
  });
}

export async function markProjectStatus(
  db: DbClient,
  projectId: string,
  status: "SOURCE_PROCESSING" | "SOURCE_READY" | "SOURCE_FAILED" | "HOOKS_PENDING" | "HOOKS_READY" | "GENERATION_PENDING" | "COMPLETED" | "FAILED",
  errorMessage?: string
) {
  return db.project.update({
    where: { id: projectId },
    data: { status, errorMessage }
  });
}

export async function findProject(db: DbClient, projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      user: true,
      sourceAssets: true,
      transcripts: true,
      hooks: { orderBy: [{ score: "desc" }, { createdAt: "asc" }] },
      selectedHook: true,
      selectedTemplate: true,
      guestFaceAsset: true
    }
  });
}

export async function listUserProjects(db: DbClient, userId: string) {
  return db.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { selectedTemplate: true, selectedHook: true }
  });
}
