import { ObjectStorage } from "@covers/storage";

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

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Reference URL did not return an image: ${contentType}`);
  }

  const extension = extensionForContentType(contentType);
  const mirroredUrl = await storage.uploadBuffer({
    key: `generations/${generationId}/references/input-${index + 1}.${extension}`,
    body: Buffer.from(await response.arrayBuffer()),
    contentType
  });

  if (!mirroredUrl.startsWith("http")) {
    throw new Error("S3_PUBLIC_BASE_URL must be an HTTPS public URL for Kie image references.");
  }

  return mirroredUrl;
}

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}
