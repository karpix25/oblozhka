import type { ImageGenerationInput, ImageGenerationResult } from "./types.js";

type KieResponse = Record<string, unknown>;

export class KieImageClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly callbackUrl?: string;

  constructor(config: { apiKey?: string; baseUrl?: string; model?: string; callbackUrl?: string } = {}) {
    this.apiKey = config.apiKey ?? process.env.KIE_API_KEY ?? "";
    this.baseUrl = (config.baseUrl ?? process.env.KIE_BASE_URL ?? "https://api.kie.ai").replace(/\/$/, "");
    this.model = config.model ?? process.env.KIE_IMAGE_MODEL ?? "gpt-image-2-image-to-image";
    this.pollIntervalMs = Number(process.env.KIE_POLL_INTERVAL_MS ?? 3000);
    this.pollTimeoutMs = Number(process.env.KIE_POLL_TIMEOUT_MS ?? 900000);
    this.callbackUrl = config.callbackUrl ?? process.env.KIE_CALLBACK_URL;
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      throw new Error("KIE_API_KEY is required.");
    }

    const inputUrls = input.imageUrls?.length ? input.imageUrls : input.imageUrl ? [input.imageUrl] : [];
    if (inputUrls.length === 0) {
      throw new Error("Kie.ai image-to-image generation requires a reference image URL.");
    }

    const response = await this.post(`${this.baseUrl}/api/v1/jobs/createTask`, {
      model: this.model,
      callBackUrl: this.callbackUrl || undefined,
      input: {
        prompt: input.prompt,
        input_urls: inputUrls,
        aspect_ratio: input.aspectRatio
      }
    });

    const immediate = await this.extractImage(response);
    if (immediate) {
      return { bytes: immediate, model: this.model, raw: response };
    }

    const taskId = this.extractTaskId(response);
    if (!taskId) {
      throw new Error("Kie.ai did not return image bytes, image URL, or a task id.");
    }

    return this.pollTask(taskId, response);
  }

  private async pollTask(taskId: string, initial: KieResponse): Promise<ImageGenerationResult> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < this.pollTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      const status = await this.get(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
      const image = await this.extractImage(status);
      if (image) {
        return { bytes: image, model: this.model, raw: { initial, status } };
      }
      const state = this.extractState(status);
      if (["fail", "failed", "error", "canceled", "cancelled"].includes(state)) {
        throw new Error(`Kie.ai task failed: ${JSON.stringify(status)}`);
      }
    }
    throw new Error("Kie.ai task timed out.");
  }

  private async post(url: string, body: object): Promise<KieResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Kie.ai request failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<KieResponse>;
  }

  private async get(url: string): Promise<KieResponse> {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error(`Kie.ai polling failed: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<KieResponse>;
  }

  private async extractImage(response: KieResponse): Promise<Buffer | undefined> {
    const normalized = this.withParsedResultJson(response);
    const value = this.findString(normalized, ["b64_json", "base64", "image_base64", "url", "image_url", "imageUrl", "output", "resultUrls"]);
    if (!value) return undefined;
    if (value.startsWith("data:image/")) {
      return Buffer.from(value.split(",")[1] ?? "", "base64");
    }
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 1000) {
      return Buffer.from(value, "base64");
    }
    if (value.startsWith("http")) {
      const image = await fetch(value);
      if (!image.ok) {
        throw new Error(`Failed to download Kie.ai image: ${image.status}`);
      }
      return Buffer.from(await image.arrayBuffer());
    }
    return undefined;
  }

  private extractTaskId(response: KieResponse): string | undefined {
    return this.findString(response, ["taskId", "task_id", "id", "requestId", "request_id"]);
  }

  private extractState(response: KieResponse): string {
    return String(this.findString(response, ["state", "status"]) ?? "").toLowerCase();
  }

  private withParsedResultJson(response: KieResponse): KieResponse {
    const resultJson = this.findString(response, ["resultJson"]);
    if (!resultJson) return response;
    try {
      return { ...response, parsedResultJson: JSON.parse(resultJson) };
    } catch {
      return response;
    }
  }

  private findString(value: unknown, keys: string[]): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    for (const [key, nested] of Object.entries(value)) {
      if (keys.includes(key) && typeof nested === "string" && nested.length > 0) return nested;
      if (keys.includes(key) && Array.isArray(nested) && typeof nested[0] === "string") return nested[0];
      const found = this.findString(nested, keys);
      if (found) return found;
    }
    return undefined;
  }
}
