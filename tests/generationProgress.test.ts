import test from "node:test";
import assert from "node:assert/strict";
import { generationProgressText } from "../apps/worker/src/generationProgress.js";

test("generation progress renders one animated sentence", () => {
  assert.equal(generationProgressText("generation", 1), "⏳ Генерирую финальную обложку.");
  assert.equal(generationProgressText("generation", 2), "⏳ Генерирую финальную обложку..");
  assert.equal(generationProgressText("generation", 3), "⏳ Генерирую финальную обложку...");
});

test("completed generation progress is one final sentence", () => {
  assert.equal(generationProgressText("ready"), "✅ Обложка готова.");
});
