import test from "node:test";
import assert from "node:assert/strict";
import { avatarLimitMessage, insufficientCreditsMessage, tariffsMessage } from "../apps/bot/src/billingMessages.js";
import { insufficientCreditsKeyboard } from "../apps/bot/src/sectionKeyboards.js";

test("insufficient credits response gives a direct purchase path", () => {
  assert.match(insufficientCreditsMessage(), /Выбрать тариф/);
  assert.deepEqual(insufficientCreditsKeyboard().inline_keyboard[0], [
    { text: "⭐ Выбрать тариф", callback_data: "packages" }
  ]);
});

test("tariff text makes locked style and priority features clear", () => {
  const message = tariffsMessage();

  assert.match(message, /без своего стиля и копирования шаблона/);
  assert.match(message, /свой стиль и копирование шаблона/);
  assert.match(message, /AI-фильтры и эмоции лица/);
  assert.match(message, /приоритетные функции и поддержка/);
});

test("avatar limit message points Start users to higher tiers", () => {
  const message = avatarLimitMessage(1);

  assert.match(message, /Pro даёт до 10 аватаров/);
  assert.match(message, /Business — без жесткого лимита/);
});
