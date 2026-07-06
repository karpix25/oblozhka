import test from "node:test";
import assert from "node:assert/strict";
import { MONITORED_QUEUE_NAMES } from "../apps/api/src/routes/ops/queueStatus.js";
import { queuedFaceCardMetadata } from "../apps/bot/src/faceAssetMetadata.js";
import { FACE_CARD_QUEUE } from "../packages/domain/src/index.js";

test("queued face metadata keeps source image and background status", () => {
  const metadata = queuedFaceCardMetadata(
    {
      role: "primary-reference",
      projectId: "project-1",
      sourceImageUrl: "https://telegram.example/file.png",
      telegramFilePath: "photos/file.png",
      telegramFileId: "telegram-file-1"
    },
    new Date("2026-07-06T12:00:00.000Z")
  );

  assert.deepEqual(metadata, {
    role: "primary-reference",
    projectId: "project-1",
    sourceImageUrl: "https://telegram.example/file.png",
    sourceTelegramFilePath: "photos/file.png",
    sourceTelegramFileId: "telegram-file-1",
    faceCardStatus: "queued",
    faceCardQueuedAt: "2026-07-06T12:00:00.000Z"
  });
});

test("queued face metadata omits optional project id when absent", () => {
  const metadata = queuedFaceCardMetadata(
    {
      role: "guest-reference",
      sourceImageUrl: "https://telegram.example/guest.png",
      telegramFilePath: "photos/guest.png",
      telegramFileId: "telegram-file-2"
    },
    new Date("2026-07-06T12:05:00.000Z")
  );

  assert.equal("projectId" in metadata, false);
  assert.equal(metadata.faceCardStatus, "queued");
});

test("ops queue monitor includes background face-card jobs", () => {
  assert.equal(FACE_CARD_QUEUE, "face-card-generation");
  assert.ok(MONITORED_QUEUE_NAMES.includes(FACE_CARD_QUEUE));
});
