import test from "node:test";
import assert from "node:assert/strict";
import { toTelegramPhotoUrl } from "../apps/bot/src/mediaUrls.js";

test("converts stored s3 URLs to public HTTPS URLs for Telegram", () => {
  const previousBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com/bucket";

  try {
    assert.equal(
      toTelegramPhotoUrl("s3://bucket/user-faces/user-1/avatar card.png"),
      "https://cdn.example.com/bucket/user-faces/user-1/avatar%20card.png"
    );
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env.S3_PUBLIC_BASE_URL;
    } else {
      process.env.S3_PUBLIC_BASE_URL = previousBaseUrl;
    }
  }
});

test("keeps regular HTTP photo URLs unchanged", () => {
  assert.equal(toTelegramPhotoUrl("https://example.com/photo.png"), "https://example.com/photo.png");
});
