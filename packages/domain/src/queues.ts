export const GENERATION_QUEUE = "cover-generation";
export const HOOK_QUEUE = "hook-generation";
export const FACE_CARD_QUEUE = "face-card-generation";
export const SOURCE_QUEUE = "source-ingestion";

export type FaceCardJobData = {
  faceAssetId: string;
  userId: string;
  sourceImageUrl: string;
  telegramFilePath: string;
  telegramFileId: string;
};
