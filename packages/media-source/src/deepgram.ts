import type { TranscriptResult } from "./types.js";

export class DeepgramTranscriptionClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly language?: string;

  constructor(config: { apiKey?: string; model?: string; language?: string } = {}) {
    this.apiKey = config.apiKey ?? process.env.DEEPGRAM_API_KEY ?? "";
    this.model = config.model ?? process.env.DEEPGRAM_MODEL ?? "nova-3";
    this.language = (config.language ?? process.env.DEEPGRAM_LANGUAGE) || undefined;
  }

  async transcribeUrl(url: string): Promise<TranscriptResult | undefined> {
    if (!this.apiKey) return undefined;

    const params = new URLSearchParams({
      model: this.model,
      smart_format: "true",
      paragraphs: "true"
    });
    if (this.language) params.set("language", this.language);

    const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: {
        authorization: `Token ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`Deepgram transcription failed: ${response.status} ${await response.text()}`);
    }

    const raw = await response.json();
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
