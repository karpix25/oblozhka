import { createUserFaceAsset, prisma } from "@covers/db";
import { queuedFaceCardMetadata, type UploadedFaceRole } from "./faceAssetMetadata.js";
import { faceCardJobId, faceCardQueue } from "./queue.js";

export type QueuedFaceAssetInput = {
  userId: string;
  sourceImageUrl: string;
  telegramFilePath: string;
  telegramFileId: string;
  title: string;
  role: UploadedFaceRole;
  projectId?: string;
};

export async function createQueuedFaceAsset(input: QueuedFaceAssetInput) {
  const metadata = queuedFaceCardMetadata(input);
  const face = await createUserFaceAsset(prisma, {
    userId: input.userId,
    imageUrl: input.sourceImageUrl,
    telegramFileId: input.telegramFileId,
    title: input.title,
    metadata
  });

  await faceCardQueue.add(
    "prepare-face-card",
    {
      faceAssetId: face.id,
      userId: input.userId,
      sourceImageUrl: input.sourceImageUrl,
      telegramFilePath: input.telegramFilePath,
      telegramFileId: input.telegramFileId
    },
    { jobId: faceCardJobId(face.id) }
  );

  return face;
}
