import test from "node:test";
import assert from "node:assert/strict";
import { prepareReferenceImageUrls } from "../apps/worker/src/referenceImages.js";

test("reference image mirroring rejects oversized content length", async () => {
  const previousFetch = globalThis.fetch;
  const previousMaxBytes = process.env.REFERENCE_IMAGE_MAX_BYTES;
  process.env.REFERENCE_IMAGE_MAX_BYTES = "10";
  globalThis.fetch = async () =>
    new Response("too-large", {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": "11"
      }
    });

  try {
    await assert.rejects(
      () =>
        prepareReferenceImageUrls({
          generationId: "gen-1",
          urls: ["https://example.com/ref.png"],
          storage: {
            publicUrlFor: (url: string) => url,
            uploadBuffer: async () => "https://cdn.example.com/ref.png"
          } as never
        }),
      /Reference image is too large/
    );
  } finally {
    globalThis.fetch = previousFetch;
    process.env.REFERENCE_IMAGE_MAX_BYTES = previousMaxBytes;
  }
});

test("stored S3 reference is converted to configured public HTTPS URL", async () => {
  const urls = await prepareReferenceImageUrls({
    generationId: "gen-1",
    urls: ["s3://covers/user-faces/face.png"],
    storage: {
      publicUrlFor: () => "https://cdn.example.com/covers/user-faces/face.png",
      uploadBuffer: async () => {
        throw new Error("Stored S3 references should not be uploaded again.");
      }
    } as never
  });

  assert.deepEqual(urls, ["https://cdn.example.com/covers/user-faces/face.png"]);
});

test("stored S3 reference fails early when no public URL is configured", async () => {
  await assert.rejects(
    prepareReferenceImageUrls({
      generationId: "gen-1",
      urls: ["s3://covers/user-faces/face.png"],
      storage: {
        publicUrlFor: (url: string) => url
      } as never
    }),
    /S3_PUBLIC_BASE_URL is required/
  );
});
