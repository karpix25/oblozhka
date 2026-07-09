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

  assert.match(message, /AI-правки, без своего стиля/);
  assert.match(message, /свой стиль и копирование стиля/);
  assert.match(message, /приоритетная очередь/);
});

test("avatar limit message points Start users to higher tiers", () => {
  const message = avatarLimitMessage(1);

  assert.match(message, /Pro даёт до 10 аватаров/);
  assert.match(message, /Business — без жесткого лимита/);
});
