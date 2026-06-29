import { detectSocialPlatform } from "./urlDetection.js";
import type { TranscriptResult } from "./types.js";

export class ScrapeCreatorsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly language?: string;

  constructor(config: { apiKey?: string; baseUrl?: string; language?: string } = {}) {
    this.apiKey = config.apiKey ?? process.env.SCRAPECREATORS_API_KEY ?? "";
    this.baseUrl = (config.baseUrl ?? process.env.SCRAPECREATORS_BASE_URL ?? "https://api.scrapecreators.com").replace(/\/$/, "");
    this.language = (config.language ?? process.env.SCRAPECREATORS_TRANSCRIPT_LANGUAGE) || undefined;
  }

  async transcriptFromUrl(url: string): Promise<TranscriptResult | undefined> {
    if (!this.apiKey) return undefined;

    const platform = detectSocialPlatform(url);
    if (platform === "unknown") return undefined;

    const endpoint = this.endpointFor(platform);
    const params = new URLSearchParams({ url });
    if (this.language) params.set("language", this.language);
    if (platform === "tiktok") {
      params.set("use_ai_as_fallback", process.env.SCRAPECREATORS_TIKTOK_AI_FALLBACK ?? "false");
    }

    const response = await fetch(`${this.baseUrl}${endpoint}?${params.toString()}`, {
      headers: { "x-api-key": this.apiKey }
    });

    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(`ScrapeCreators transcript failed: ${response.status} ${await response.text()}`);
    }

    const raw = await response.json();
    const text = this.extractTranscript(raw);
    if (!text) return undefined;

    return {
      text,
      language: this.extractLanguage(raw),
      provider: `scrapecreators:${platform}`,
      raw
    };
  }

  private endpointFor(platform: "youtube" | "tiktok" | "instagram") {
    if (platform === "youtube") return "/v1/youtube/video/transcript";
    if (platform === "tiktok") return "/v1/tiktok/video/transcript";
    return "/v2/instagram/media/transcript";
  }

  private extractTranscript(raw: unknown): string | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const record = raw as Record<string, unknown>;
    if (typeof record.transcript_only_text === "string") return record.transcript_only_text;
    if (typeof record.transcript === "string") return stripWebVtt(record.transcript);
    if (Array.isArray(record.transcript)) {
      return record.transcript
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : undefined))
        .filter((text): text is string => typeof text === "string")
        .join(" ");
    }
    if (Array.isArray(record.transcripts)) {
      return record.transcripts
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : undefined))
        .filter((text): text is string => typeof text === "string")
        .join("\n\n");
    }
    return undefined;
  }

  private extractLanguage(raw: unknown): string | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const language = (raw as Record<string, unknown>).language;
    return typeof language === "string" ? language : undefined;
  }
}

function stripWebVtt(input: string) {
  return input
    .replace(/^WEBVTT\s*/i, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.includes("-->") && !/^\d+$/.test(line.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
