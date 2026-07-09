import test from "node:test";
import assert from "node:assert/strict";
import { MODERNIZATION_ACTIONS } from "@covers/domain";
import { generationResultKeyboard } from "../apps/worker/src/notifier.js";

test("generation result keyboard offers modernization actions with compact callbacks", () => {
  const generationId = "cmre02zse001irw0rsxsww0c3";
  const keyboard = generationResultKeyboard(generationId);
  const buttons = keyboard.flat();
  const callbacks = buttons.map((button) => button.callback_data);

  for (const action of MODERNIZATION_ACTIONS) {
    assert(callbacks.includes(`modernize:${action.id}:${generationId}`));
  }
  for (const callback of callbacks) {
    assert(callback.length <= 64, `${callback} is too long for Telegram callback_data`);
  }
});

test("generation result keyboard marks unavailable actions by plan", () => {
  const generationId = "cmre02zse001irw0rsxsww0c3";
  const startLabels = generationResultKeyboard(generationId, "START").flat().map((button) => button.text);
  const proLabels = generationResultKeyboard(generationId, "PRO").flat().map((button) => button.text);
  const businessLabels = generationResultKeyboard(generationId, "BUSINESS").flat().map((button) => button.text);

  assert(startLabels.includes("🔁 Повторить стиль ⭐ Pro"));
  assert(startLabels.includes("😮 Другая эмоция ⭐ Business"));
  assert(proLabels.includes("🔁 Повторить стиль"));
  assert(proLabels.includes("🎛 AI-фильтр ⭐ Business"));
  assert(businessLabels.includes("😮 Другая эмоция"));
  assert(businessLabels.includes("🎛 AI-фильтр"));
});

test("modernization actions keep user-facing and queued labels explicit", () => {
  assert(MODERNIZATION_ACTIONS.length >= 5);
  for (const action of MODERNIZATION_ACTIONS) {
    assert.match(action.label, /[А-Яа-яA-Za-z]/);
    assert.match(action.queuedLabel, /[А-Яа-яA-Za-z]/);
    assert.match(action.promptInstruction, /thumbnail|cover|layout|style|text|face|contrast|filter/i);
  }
});
