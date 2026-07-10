import test from "node:test";
import assert from "node:assert/strict";
import { hookProgressText } from "../apps/worker/src/hookProgress.js";
import { ProgressAnimator } from "../apps/worker/src/progressAnimator.js";

test("progress animator cycles dots by editing the same message", async () => {
  const edits: string[] = [];
  const progress = { chatId: 38061745, messageId: 42 };
  const animator = new ProgressAnimator(async (message, text) => {
    assert.deepEqual(message, progress);
    edits.push(text);
  }, 10);

  animator.start(progress, (frame) => hookProgressText("source", frame));
  try {
    await waitFor(() => edits.length >= 3);
  } finally {
    await animator.stop(progress);
  }

  assert.deepEqual(edits.slice(0, 3), [
    "⏳ Изучаю источник и извлекаю содержание..",
    "⏳ Изучаю источник и извлекаю содержание...",
    "⏳ Изучаю источник и извлекаю содержание."
  ]);
});

test("progress animator switches the sentence without creating a new message", async () => {
  const edits: string[] = [];
  const progress = { chatId: 38061745, messageId: 43 };
  const animator = new ProgressAnimator(async (_message, text) => {
    edits.push(text);
  }, 1000);

  animator.start(progress, (frame) => hookProgressText("source", frame));
  await animator.update(progress, (frame) => hookProgressText("selection", frame));
  await animator.stop(progress);

  assert.deepEqual(edits, ["⏳ Сравниваю варианты и выбираю лучший текст."]);
});

async function waitFor(predicate: () => boolean, timeoutMs = 500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error("Timed out waiting for progress animation.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
