import { fetchTextWithTimeout, positiveNumber } from "./fetchWithTimeout.js";
import type { TranscriptResult } from "./types.js";

export class DeepgramTranscriptionClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly language?: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey?: string; model?: string; language?: string; timeoutMs?: number } = {}) {
    this.apiKey = config.apiKey ?? process.env.DEEPGRAM_API_KEY ?? "";
    this.model = config.model ?? process.env.DEEPGRAM_MODEL ?? "nova-3";
    this.language = (config.language ?? process.env.DEEPGRAM_LANGUAGE) || undefined;
    this.timeoutMs = config.timeoutMs ?? positiveNumber(process.env.DEEPGRAM_TIMEOUT_MS, 120000);
  }

  async transcribeUrl(url: string, options: { signal?: AbortSignal } = {}): Promise<TranscriptResult | undefined> {
    if (!this.apiKey) return undefined;

    const params = new URLSearchParams({
      model: this.model,
      smart_format: "true",
      paragraphs: "true"
    });
    if (this.language) params.set("language", this.language);

    const response = await fetchTextWithTimeout(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: "POST",
        headers: {
          authorization: `Token ${this.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ url })
      },
      {
        description: "Deepgram transcription",
        signal: options.signal,
        timeoutMs: this.timeoutMs
      }
    );

    if (!response.ok) {
      throw new Error(`Deepgram transcription failed: ${response.status} ${response.text}`);
    }

    const raw = JSON.parse(response.text);
    const text = extractDeepgramTranscript(raw);
    if (!text) return undefined;

    return { text, provider: "deepgram", raw };
  }
}

function extractDeepgramTranscript(raw: unknown): string | undefined {
  const channel = (raw as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  }).results?.channels?.[0];
  return channel?.alternatives?.[0]?.transcript?.trim() || undefined;
}
