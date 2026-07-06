import { ObjectStorage } from "@covers/storage";
import { detectImageMime } from "./imageMime.js";

export async function prepareReferenceImageUrls(input: {
  generationId: string;
  urls: string[];
  storage: ObjectStorage;
  signal?: AbortSignal;
}) {
  const prepared: string[] = [];

  for (const [index, url] of input.urls.entries()) {
    prepared.push(await mirrorReferenceImage(input.storage, input.generationId, url, index, input.signal));
  }

  return prepared;
}

async function mirrorReferenceImage(storage: ObjectStorage, generationId: string, url: string, index: number, signal?: AbortSignal) {
  if (!url.startsWith("http")) return url;

  const downloaded = await downloadReferenceImage(url, signal);
  const imageMime = detectImageMime(downloaded.body, downloaded.contentType);
  if (!imageMime) {
    throw new Error(`Reference URL did not return a supported image: ${downloaded.contentType ?? "unknown"}`);
  }

  const mirroredUrl = await storage.uploadBuffer({
    key: `generations/${generationId}/references/input-${index + 1}.${imageMime.extension}`,
    body: downloaded.body,
    contentType: imageMime.contentType
  });

  if (!mirroredUrl.startsWith("https://")) {
    console.warn("Reference image storage URL is not public HTTPS; falling back to source URL for Kie.", {
      generationId,
      index,
      storageUrlScheme: mirroredUrl.split(":")[0] || "unknown"
    });
    return url;
  }

  return mirroredUrl;
}

async function downloadReferenceImage(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutMs = positiveIntegerEnv("REFERENCE_IMAGE_TIMEOUT_MS", 30000);
  const timeout = setTimeout(() => controller.abort(new Error(`Reference image download timed out after ${timeoutMs}ms.`)), timeoutMs);
  const abortFromParent = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    abortFromParent();
  } else {
    signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Reference image download failed: ${response.status}`);
    }
    return {
      body: await readLimitedResponse(response),
      contentType: response.headers.get("content-type")
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

async function readLimitedResponse(response: Response) {
  const maxBytes = positiveIntegerEnv("REFERENCE_IMAGE_MAX_BYTES", 15 * 1024 * 1024);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Reference image is too large: ${contentLength} bytes.`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > maxBytes) {
    throw new Error(`Reference image is too large: ${body.byteLength} bytes.`);
  }
  return body;
}

function positiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
