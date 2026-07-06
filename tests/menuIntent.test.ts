import test from "node:test";
import assert from "node:assert/strict";
import { menuIntentFromText } from "../apps/bot/src/menuIntent.js";

test("menuIntentFromText keeps legacy reply labels working", () => {
  assert.equal(menuIntentFromText("🎨 Создать"), "create");
  assert.equal(menuIntentFromText("🖼 Шаблоны"), "templates");
  assert.equal(menuIntentFromText("💎 Баланс"), "balance");
  assert.equal(menuIntentFromText("🎭 Мои стили"), "styles");
});

test("menuIntentFromText accepts natural user fallback phrases", () => {
  assert.equal(menuIntentFromText("Создать обложку"), "create");
  assert.equal(menuIntentFromText("сделать обложку"), "create");
  assert.equal(menuIntentFromText("мои лица"), "faces");
  assert.equal(menuIntentFromText("свой стиль"), "styles");
  assert.equal(menuIntentFromText("как это работает"), "help");
});

test("menuIntentFromText ignores unrelated text", () => {
  assert.equal(menuIntentFromText("привет, сделай красиво"), undefined);
});
