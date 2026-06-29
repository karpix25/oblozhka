export type TranscriptResult = {
  text: string;
  language?: string;
  provider: string;
  raw: unknown;
};

export type SocialPlatform = "youtube" | "tiktok" | "instagram" | "unknown";
