import type { SocialPlatform } from "./types.js";

export function detectSocialPlatform(url: string): SocialPlatform {
  const normalized = url.toLowerCase();
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "youtube";
  if (normalized.includes("tiktok.com")) return "tiktok";
  if (normalized.includes("instagram.com")) return "instagram";
  return "unknown";
}
