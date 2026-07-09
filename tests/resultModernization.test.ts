import test from "node:test";
import assert from "node:assert/strict";
import { MODERNIZATION_ACTIONS } from "@covers/domain";
import { generationResultKeyboard } from "../apps/worker/src/notifier.js";

test("generation result keyboard offers result actions with compact callbacks", () => {
  const generationId = "cmre02zse001irw0rsxsww0c3";
  const keyboard = generationResultKeyboard(generationId);
  const buttons = keyboard.flat();
  const callbacks = buttons.map((button) => button.callback_data);

  assert.deepEqual(MODERNIZATION_ACTIONS.map((action) => action.id), ["custom_edit", "replicate_template"]);
  assert(callbacks.includes(`modernize:custom_edit:${generationId}`));
  assert(callbacks.includes(`modernize:replicate_template:${generationId}`));
  for (const callback of callbacks) {
    assert(callback.length <= 64, `${callback} is too long for Telegram callback_data`);
  }
});

test("generation result keyboard marks custom edit availability by plan", () => {
  const generationId = "cmre02zse001irw0rsxsww0c3";
  const trialLabels = generationResultKeyboard(generationId, null).flat().map((button) => button.text);
  const businessLabels = generationResultKeyboard(generationId, "BUSINESS").flat().map((button) => button.text);

  assert(trialLabels.includes("✍️ Описать правку ⭐ Start"));
  assert(trialLabels.includes("🔁 Повторить шаблон ⭐ Pro"));
  assert(businessLabels.includes("✍️ Описать правку"));
  assert(businessLabels.includes("🔁 Повторить шаблон"));
});

test("modernization actions keep user-facing and queued labels explicit", () => {
  assert.equal(MODERNIZATION_ACTIONS.length, 2);
  for (const action of MODERNIZATION_ACTIONS) {
    assert.match(action.label, /[А-Яа-яA-Za-z]/);
    assert.match(action.queuedLabel, /[А-Яа-яA-Za-z]/);
    assert.match(action.promptInstruction, /thumbnail|edit|original|template|reference/i);
  }
});
