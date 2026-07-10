import test from "node:test";
import assert from "node:assert/strict";
import { hookProgressText } from "../apps/worker/src/hookProgress.js";

test("hook progress shows completed current and upcoming steps", () => {
  const text = hookProgressText("generation");

  assert.match(text, /✅ 1\. Изучаю источник/);
  assert.match(text, /⏳ 2\. Анализирую смысл/);
  assert.match(text, /▫️ 3\. Сравниваю варианты/);
  assert.match(text, /▫️ 4\. Текст для обложки выбран/);
  assert.match(text, /будет обновляться автоматически/);
});

test("completed hook progress keeps the full successful checklist", () => {
  const text = hookProgressText("ready");

  assert.match(text, /^✅ Текст для обложки готов/);
  assert.equal((text.match(/✅/g) ?? []).length, 5);
  assert.match(text, /Следующий шаг отправлен отдельным сообщением/);
});
