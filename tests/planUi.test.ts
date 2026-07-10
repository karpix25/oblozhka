import test from "node:test";
import assert from "node:assert/strict";
import type { BillingAccess } from "@covers/db";
import { mainKeyboard, styleSourceKeyboard } from "../apps/bot/src/keyboards.js";
import { customStyleMenuLabel, customStyleSourceLabel, customStyleUploadLabel } from "../apps/bot/src/planUi.js";

const trialAccess: BillingAccess = {
  kind: "trial",
  remainingCredits: 3,
  monthlyCreditLimit: 3,
  avatarLimit: 1,
  queuePriority: 50,
  currentPeriodEnd: null
};

const startAccess: BillingAccess = {
  kind: "subscription",
  subscriptionId: "sub_start",
  plan: "START",
  remainingCredits: 100,
  monthlyCreditLimit: 100,
  avatarLimit: 1,
  queuePriority: 30,
  currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z")
};

const proAccess: BillingAccess = {
  ...startAccess,
  subscriptionId: "sub_pro",
  plan: "PRO",
  avatarLimit: 10,
  queuePriority: 10
};

test("premium style labels stay visible but marked for trial and Start", () => {
  assert.equal(customStyleMenuLabel(trialAccess), "🎭 Мои стили ⭐ Pro");
  assert.equal(customStyleMenuLabel(startAccess), "🎭 Мои стили ⭐ Pro");
  assert.equal(customStyleSourceLabel(startAccess), "🎭 Мой стиль ⭐ Pro");
  assert.equal(customStyleUploadLabel(startAccess), "➕ Загрузить стиль ⭐ Pro");
});

test("premium style labels are plain for Pro users", () => {
  assert.equal(customStyleMenuLabel(proAccess), "🎭 Мои стили");
  assert.equal(customStyleSourceLabel(proAccess), "🎭 Мой стиль");
  assert.equal(customStyleUploadLabel(proAccess), "➕ Загрузить стиль");
});

test("bot keyboards expose premium style entries instead of hiding them", () => {
  assert.deepEqual(mainKeyboard(startAccess).inline_keyboard[1][1], {
    text: "🎭 Мои стили ⭐ Pro",
    callback_data: "styles:mine"
  });
  assert.deepEqual(styleSourceKeyboard(startAccess).inline_keyboard[1][0], {
    text: "🎭 Мой стиль ⭐ Pro",
    callback_data: "style-source:custom"
  });
  assert.deepEqual(mainKeyboard(startAccess).inline_keyboard[3][0], {
    text: "🖼 Мои обложки",
    callback_data: "covers:mine"
  });
});
