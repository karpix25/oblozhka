import test from "node:test";
import assert from "node:assert/strict";
import {
  detectContentLanguage,
  OpenRouterPromptPlanner,
  resolveContentLanguage
} from "../packages/generation-ai/src/index.js";

test("content language resolves Russian from provider metadata and transcript text", () => {
  assert.equal(resolveContentLanguage("ru", "Product launch"), "ru");
  assert.equal(resolveContentLanguage(undefined, "Видео о запуске продукта и ошибках рекламы."), "ru");
  assert.equal(detectContentLanguage("A product launch workflow"), "other");
});

test("Russian source language is enforced in fallback image prompts", async () => {
  const planner = new OpenRouterPromptPlanner({ apiKey: "" });
  const plan = await planner.plan({
    wizard: {
      format: "YOUTUBE",
      referenceMode: "NONE",
      topic: "Запуск продукта",
      niche: "Бизнес",
      hookText: "ГЛАВНАЯ ОШИБКА",
      style: "Контраст"
    },
    formatDescription: "YouTube cover",
    aspectRatio: "16:9",
    contentLanguage: "ru"
  });

  assert.match(plan.prompt, /source video is in Russian/i);
  assert.match(plan.prompt, /all visible text, labels, badges, buttons, signs and decorative words in Russian only/i);
  assert.match(plan.prompt, /Do not add English words/i);
});

test("Russian hook fallback excludes English words from a mixed transcript", async () => {
  const planner = new OpenRouterPromptPlanner({ apiKey: "" });
  const hooks = await planner.generateHooks({
    transcript: "ChatGPT помогает бизнесу автоматизировать продажи и находить ошибки.",
    platform: "YOUTUBE",
    contentLanguage: "ru"
  });

  assert.equal(hooks.length, 5);
  assert.ok(hooks.every((hook) => !/[A-Za-z]/.test(hook.text)));
});
