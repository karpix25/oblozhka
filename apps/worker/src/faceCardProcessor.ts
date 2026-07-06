import {
  findUserFaceAssetById,
  prisma,
  updateUserFaceAssetUrl
} from "@covers/db";
import {
  FACE_CARD_PROMPT,
  isGeneratedFaceCardMetadata,
  type FaceCardJobData,
  type FaceCardMetadata
} from "@covers/domain";
import { KieImageClient } from "@covers/generation-ai";
import { ObjectStorage } from "@covers/storage";

type FaceCardProcessorDeps = {
  imageClient?: Pick<KieImageClient, "generate">;
  storage?: Pick<ObjectStorage, "uploadBuffer">;
};

type PreparedFaceCard = {
  imageUrl: string;
  metadata: FaceCardMetadata;
};

const defaultImageClient = new KieImageClient();
const defaultStorage = new ObjectStorage();

export async function processFaceCardJob(
  data: FaceCardJobData,
  options: { signal?: AbortSignal; deps?: FaceCardProcessorDeps } = {}
) {
  const face = await findUserFaceAssetById(prisma, data.faceAssetId);
  if (!face) {
    throw new Error(`Face asset ${data.faceAssetId} was not found.`);
  }
  if (face.userId !== data.userId) {
    throw new Error(`Face asset ${data.faceAssetId} does not belong to user ${data.userId}.`);
  }
  if (isGeneratedFaceCardMetadata(face.metadata)) {
    return face;
  }

  const prepared = await prepareFaceCard(data, options);
  return updateUserFaceAssetUrl(prisma, face.id, prepared.imageUrl, {
    ...objectMetadata(face.metadata),
    ...prepared.metadata
  });
}

async function prepareFaceCard(
  input: FaceCardJobData,
  options: { signal?: AbortSignal; deps?: FaceCardProcessorDeps } = {}
): Promise<PreparedFaceCard> {
  const imageClient = options.deps?.imageClient ?? defaultImageClient;
  const storage = options.deps?.storage ?? defaultStorage;

  try {
    const result = await imageClient.generate({
      prompt: FACE_CARD_PROMPT,
      imageUrl: input.sourceImageUrl,
      aspectRatio: "4:3",
      resolution: process.env.FACE_CARD_RESOLUTION ?? "1K",
      signal: options.signal
    });
    const imageUrl = await storage.uploadBuffer({
      key: faceCardStorageKey(input.userId, input.telegramFileId),
      body: result.bytes,
      contentType: "image/png"
    });

    return {
      imageUrl,
      metadata: {
        sourceImageUrl: input.sourceImageUrl,
        sourceTelegramFilePath: input.telegramFilePath,
        sourceTelegramFileId: input.telegramFileId,
        faceCardStatus: "generated",
        faceCardPrompt: FACE_CARD_PROMPT,
        faceCardModel: result.model,
        faceCardGeneratedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      imageUrl: input.sourceImageUrl,
      metadata: {
        sourceImageUrl: input.sourceImageUrl,
        sourceTelegramFilePath: input.telegramFilePath,
        sourceTelegramFileId: input.telegramFileId,
        faceCardStatus: "fallback",
        faceCardPrompt: FACE_CARD_PROMPT,
        faceCardError: error instanceof Error ? error.message : String(error),
        faceCardFailedAt: new Date().toISOString()
      }
    };
  }
}

function faceCardStorageKey(userId: string, telegramFileId: string) {
  const safeFileId = telegramFileId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `user-faces/${userId}/${Date.now()}-${safeFileId}-card.png`;
}

function objectMetadata(metadata: unknown): Record<string, unknown> {
  return typeof metadata === "object" && metadata && !Array.isArray(metadata) ? { ...metadata } : {};
}
