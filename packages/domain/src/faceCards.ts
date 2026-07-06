export type FaceCardStatus = "queued" | "generated" | "fallback";

export type FaceCardMetadata = {
  role?: "primary-reference" | "guest-reference";
  projectId?: string;
  sourceImageUrl: string;
  sourceTelegramFilePath: string;
  sourceTelegramFileId?: string;
  faceCardStatus: FaceCardStatus;
  faceCardPrompt?: string;
  faceCardModel?: string;
  faceCardError?: string;
  faceCardQueuedAt?: string;
  faceCardGeneratedAt?: string;
  faceCardFailedAt?: string;
};

export const FACE_CARD_PROMPT = [
  "Create a clean character reference sheet from the uploaded person photo.",
  "Preserve the person's identity, face proportions, skin tone, hairstyle, facial hair, and distinctive facial features.",
  "Show the same person in multiple consistent head angles: front view, left three-quarter view, right three-quarter view, left profile, right profile, and one larger front portrait.",
  "Use a neutral light gray studio background, realistic photographic lighting, natural expression, no dramatic styling.",
  "No text, no labels, no captions, no UI, no logos, no watermark.",
  "Do not change the person's age, gender, ethnicity, haircut, beard, or facial structure.",
  "Keep clothing minimal and unobtrusive; focus on head and face consistency."
].join(" ");

export function isGeneratedFaceCardMetadata(metadata: unknown) {
  return hasFaceCardStatus(metadata, "generated");
}

export function hasFaceCardStatus(metadata: unknown, status: FaceCardStatus) {
  return Boolean(
    typeof metadata === "object" &&
      metadata &&
      "faceCardStatus" in metadata &&
      metadata.faceCardStatus === status
  );
}
