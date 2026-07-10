import test from "node:test";
import assert from "node:assert/strict";
import { generationProgressText } from "../apps/worker/src/generationProgress.js";

test("generation progress exposes completed current and upcoming stages", () => {
  const text = generationProgressText("generation");

  assert.match(text, /✅ 1\. Подготавливаю лицо/);
  assert.match(text, /✅ 2\. Анализирую композицию/);
  assert.match(text, /⏳ 3\. Генерирую финальную обложку/);
  assert.match(text, /▫️ 4\. Обрабатываю PNG/);
  assert.match(text, /▫️ 5\. Сохраняю и отправляю результат/);
});

test("completed generation progress remains as a successful checklist", () => {
  const text = generationProgressText("ready");

  assert.match(text, /^✅ Обложка готова/);
  assert.equal((text.match(/✅/g) ?? []).length, 7);
  assert.match(text, /Готовый файл отправлен отдельным сообщением/);
});
