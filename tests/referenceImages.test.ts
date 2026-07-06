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
