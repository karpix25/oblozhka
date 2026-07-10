import test from "node:test";
import assert from "node:assert/strict";
import { hookProgressText } from "../apps/worker/src/hookProgress.js";

test("hook progress renders one animated sentence", () => {
  assert.equal(hookProgressText("generation", 1), "⏳ Анализирую смысл и создаю варианты текста.");
  assert.equal(hookProgressText("generation", 2), "⏳ Анализирую смысл и создаю варианты текста..");
  assert.equal(hookProgressText("generation", 3), "⏳ Анализирую смысл и создаю варианты текста...");
});

test("completed hook progress is one final sentence", () => {
  assert.equal(hookProgressText("ready"), "✅ Текст для обложки готов.");
});
