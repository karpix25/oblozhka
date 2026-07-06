import test from "node:test";
import assert from "node:assert/strict";
import { insufficientCreditsMessage } from "../apps/bot/src/billingMessages.js";
import { insufficientCreditsKeyboard } from "../apps/bot/src/sectionKeyboards.js";

test("insufficient credits response gives a direct purchase path", () => {
  assert.match(insufficientCreditsMessage(), /Выбрать тариф/);
  assert.deepEqual(insufficientCreditsKeyboard().inline_keyboard[0], [
    { text: "⭐ Выбрать тариф", callback_data: "packages" }
  ]);
});
