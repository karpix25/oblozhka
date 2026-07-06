import type { FaceCardMetadata } from "@covers/domain";

export type UploadedFaceRole = "primary-reference" | "guest-reference";

export type QueuedFaceCardMetadataInput = {
  sourceImageUrl: string;
  telegramFilePath: string;
  telegramFileId: string;
  role: UploadedFaceRole;
  projectId?: string;
};

export function queuedFaceCardMetadata(input: QueuedFaceCardMetadataInput, now = new Date()): FaceCardMetadata {
  const metadata: FaceCardMetadata = {
    role: input.role,
    sourceImageUrl: input.sourceImageUrl,
    sourceTelegramFilePath: input.telegramFilePath,
    sourceTelegramFileId: input.telegramFileId,
    faceCardStatus: "queued",
    faceCardQueuedAt: now.toISOString()
  };
  if (input.projectId) {
    metadata.projectId = input.projectId;
  }
  return metadata;
}
