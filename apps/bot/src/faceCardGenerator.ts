import { KieImageClient } from "@covers/generation-ai";
import { ObjectStorage } from "@covers/storage";

export type PreparedFaceCard = {
  imageUrl: string;
  metadata: {
    sourceImageUrl: string;
    sourceTelegramFilePath: string;
    faceCardStatus: "generated" | "fallback";
    faceCardPrompt?: string;
    faceCardModel?: string;
    faceCardError?: string;
  };
};

type PrepareFaceCardInput = {
  sourceImageUrl: string;
  telegramFilePath: string;
  userId: string;
  telegramFileId: string;
};

const faceCardPrompt = [
  "Create a clean character reference sheet from the uploaded person photo.",
  "Preserve the person's identity, face proportions, skin tone, hairstyle, facial hair, and distinctive facial features.",
  "Show the same person in multiple consistent head angles: front view, left three-quarter view, right three-quarter view, left profile, right profile, and one larger front portrait.",
  "Use a neutral light gray studio background, realistic photographic lighting, natural expression, no dramatic styling.",
  "No text, no labels, no captions, no UI, no logos, no watermark.",
  "Do not change the person's age, gender, ethnicity, haircut, beard, or facial structure.",
  "Keep clothing minimal and unobtrusive; focus on head and face consistency."
].join(" ");

const imageClient = new KieImageClient();
const storage = new ObjectStorage();

export async function prepareFaceCard(input: PrepareFaceCardInput): Promise<PreparedFaceCard> {
  try {
    const result = await imageClient.generate({
      prompt: faceCardPrompt,
      imageUrl: input.sourceImageUrl,
      aspectRatio: "4:3",
      resolution: process.env.FACE_CARD_RESOLUTION ?? "1K"
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
        faceCardStatus: "generated",
        faceCardPrompt,
        faceCardModel: result.model
      }
    };
  } catch (error) {
    return {
      imageUrl: input.sourceImageUrl,
      metadata: {
        sourceImageUrl: input.sourceImageUrl,
        sourceTelegramFilePath: input.telegramFilePath,
        faceCardStatus: "fallback",
        faceCardPrompt,
        faceCardError: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function faceCardStorageKey(userId: string, telegramFileId: string) {
  const safeFileId = telegramFileId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `user-faces/${userId}/${Date.now()}-${safeFileId}-card.png`;
}
