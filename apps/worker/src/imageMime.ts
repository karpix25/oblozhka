export type ImageMime = {
  contentType: string;
  extension: string;
};

export function detectImageMime(buffer: Buffer, headerContentType?: string | null): ImageMime | undefined {
  const normalizedHeader = headerContentType?.split(";")[0]?.trim().toLowerCase();
  if (normalizedHeader?.startsWith("image/")) {
    return mimeForContentType(normalizedHeader);
  }

  if (isJpeg(buffer)) return { contentType: "image/jpeg", extension: "jpg" };
  if (isPng(buffer)) return { contentType: "image/png", extension: "png" };
  if (isWebp(buffer)) return { contentType: "image/webp", extension: "webp" };
  if (isGif(buffer)) return { contentType: "image/gif", extension: "gif" };

  return undefined;
}

function mimeForContentType(contentType: string): ImageMime {
  if (contentType.includes("png")) return { contentType, extension: "png" };
  if (contentType.includes("webp")) return { contentType, extension: "webp" };
  if (contentType.includes("gif")) return { contentType, extension: "gif" };
  return { contentType, extension: "jpg" };
}

function isJpeg(buffer: Buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function isWebp(buffer: Buffer) {
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function isGif(buffer: Buffer) {
  const signature = buffer.subarray(0, 6).toString("ascii");
  return signature === "GIF87a" || signature === "GIF89a";
}
