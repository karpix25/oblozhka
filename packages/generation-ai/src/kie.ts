import type { ImageGenerationInput, ImageGenerationResult } from "./types.js";

type KieResponse = Record<string, unknown>;
type KieGenerateInput = ImageGenerationInput & { signal?: AbortSignal };

export class KieImageClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly downloadTimeoutMs: number;
  private readonly callbackUrl?: string;

  constructor(
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      callbackUrl?: string;
      requestTimeoutMs?: number;
      downloadTimeoutMs?: number;
    } = {}
  ) {
    this.apiKey = config.apiKey ?? process.env.KIE_API_KEY ?? "";
    this.baseUrl = (config.baseUrl ?? process.env.KIE_BASE_URL ?? "https://api.kie.ai").replace(/\/$/, "");
    this.model = config.model ?? process.env.KIE_IMAGE_MODEL ?? "gpt-image-2-image-to-image";
    this.pollIntervalMs = positiveNumber(process.env.KIE_POLL_INTERVAL_MS, 3000);
    this.pollTimeoutMs = positiveNumber(process.env.KIE_POLL_TIMEOUT_MS, 900000);
    this.requestTimeoutMs = config.requestTimeoutMs ?? positiveNumber(process.env.KIE_REQUEST_TIMEOUT_MS, 120000);
    this.downloadTimeoutMs = config.downloadTimeoutMs ?? positiveNumber(process.env.KIE_DOWNLOAD_TIMEOUT_MS, 120000);
    this.callbackUrl = config.callbackUrl ?? process.env.KIE_CALLBACK_URL;
  }

  async generate(input: KieGenerateInput): Promise<ImageGenerationResult> {
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
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution ?? "1K"
      }
    }, input.signal);

    const immediate = await this.extractImage(response, input.signal);
    if (immediate) {
      return { bytes: immediate, model: this.model, raw: response };
    }

    const taskId = this.extractTaskId(response);
    if (!taskId) {
      throw new Error("Kie.ai did not return image bytes, image URL, or a task id.");
    }

    return this.pollTask(taskId, response, input.signal);
  }

  private async pollTask(taskId: string, initial: KieResponse, signal?: AbortSignal): Promise<ImageGenerationResult> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < this.pollTimeoutMs) {
      await sleep(this.pollIntervalMs, signal);
      const status = await this.get(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, signal);
      const image = await this.extractImage(status, signal);
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

  private async post(url: string, body: object, signal?: AbortSignal): Promise<KieResponse> {
    const response = await fetchTextWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      },
      {
        signal,
        timeoutMs: this.requestTimeoutMs,
        description: "Kie.ai request"
      }
    );

    if (!response.ok) {
      throw new Error(`Kie.ai request failed: ${response.status} ${response.text}`);
    }
    return JSON.parse(response.text) as KieResponse;
  }

  private async get(url: string, signal?: AbortSignal): Promise<KieResponse> {
    const response = await fetchTextWithTimeout(
      url,
      {
        headers: { authorization: `Bearer ${this.apiKey}` }
      },
      {
        signal,
        timeoutMs: this.requestTimeoutMs,
        description: "Kie.ai polling"
      }
    );

    if (!response.ok) {
      throw new Error(`Kie.ai polling failed: ${response.status} ${response.text}`);
    }
    return JSON.parse(response.text) as KieResponse;
  }

  private async extractImage(response: KieResponse, signal?: AbortSignal): Promise<Buffer | undefined> {
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
      return this.downloadImage(value, signal);
    }
    return undefined;
  }

  private async downloadImage(url: string, signal?: AbortSignal): Promise<Buffer> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const image = await fetchBufferWithTimeout(
          url,
          {},
          {
            signal,
            timeoutMs: this.downloadTimeoutMs,
            description: "Kie.ai image download"
          }
        );
        if (!image.ok) {
          throw new Error(`Failed to download Kie.ai image: ${image.status}`);
        }
        return image.body;
      } catch (error) {
        lastError = error;
        if (isAbortError(error) || signal?.aborted) {
          throw error;
        }
        if (attempt < 3) {
          await sleep(attempt * 3000, signal);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to download Kie.ai image.");
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

async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  options: { signal?: AbortSignal; timeoutMs: number; description: string }
): Promise<{ ok: boolean; status: number; text: string }> {
  return withTimeoutSignal(options, async (signal) => {
    const response = await fetch(url, { ...init, signal });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  });
}

async function fetchBufferWithTimeout(
  url: string,
  init: RequestInit,
  options: { signal?: AbortSignal; timeoutMs: number; description: string }
): Promise<{ ok: boolean; status: number; body: Buffer }> {
  return withTimeoutSignal(options, async (signal) => {
    const response = await fetch(url, { ...init, signal });
    return {
      ok: response.ok,
      status: response.status,
      body: Buffer.from(await response.arrayBuffer())
    };
  });
}

async function withTimeoutSignal<T>(
  options: { signal?: AbortSignal; timeoutMs: number; description: string },
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const abortFromParent = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromParent();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    return await action(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw new Error(`${options.description} timed out after ${options.timeoutMs}ms.`, { cause: error });
    }
    if (isAbortError(error) || options.signal?.aborted) {
      throw new Error(`${options.description} was aborted.`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Kie.ai request was aborted."));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Kie.ai request was aborted."));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
