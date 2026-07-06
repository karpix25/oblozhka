import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAndRankHooks } from "../packages/generation-ai/src/hookValidation.js";

test("hook ranking removes generic and duplicate variants", () => {
  const hooks = normalizeAndRankHooks(
    [
      { text: "Главная ошибка", score: 100 },
      { text: "60 минут без уведомлений", score: 20 },
      { text: "60 МИНУТ БЕЗ УВЕДОМЛЕНИЙ", score: 10 },
      { text: "Ты не ленивый, у тебя хаос", score: 30 }
    ],
    {
      context: { keywords: ["уведомлений", "хаос"], numbers: ["60"] },
      limit: 5
    }
  );

  assert.deepEqual(
    hooks.map((hook) => hook.text),
    ["60 минут без уведомлений", "Ты не ленивый, у тебя хаос"]
  );
});
