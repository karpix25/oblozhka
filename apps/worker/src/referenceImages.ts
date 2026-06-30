import { ObjectStorage } from "@covers/storage";
import { detectImageMime } from "./imageMime.js";

export async function prepareReferenceImageUrls(input: {
  generationId: string;
  urls: string[];
  storage: ObjectStorage;
}) {
  const prepared: string[] = [];

  for (const [index, url] of input.urls.entries()) {
    prepared.push(await mirrorReferenceImage(input.storage, input.generationId, url, index));
  }

  return prepared;
}

async function mirrorReferenceImage(storage: ObjectStorage, generationId: string, url: string, index: number) {
  if (!url.startsWith("http")) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Reference image download failed: ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const imageMime = detectImageMime(body, response.headers.get("content-type"));
  if (!imageMime) {
    throw new Error(`Reference URL did not return a supported image: ${response.headers.get("content-type") ?? "unknown"}`);
  }

  const mirroredUrl = await storage.uploadBuffer({
    key: `generations/${generationId}/references/input-${index + 1}.${imageMime.extension}`,
    body,
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
