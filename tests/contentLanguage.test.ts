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
  assert.match(plan.prompt, /every visible text element in Russian only/i);
  assert.match(plan.prompt, /badges, buttons, signs, charts, stickers, UI fragments, product labels and decorative words/i);
  assert.match(plan.prompt, /Do not add English words, Latin letters/i);
});

test("Russian visual language policy is repaired into provider prompt plans", async () => {
  await withFetch(async () =>
    new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              prompt: "Create a 16:9 YouTube cover. Use Image 1 as the uploaded face. Large readable Russian cover text: \"ГЛАВНАЯ ОШИБКА\". Keep text placement bold and central. Negative rules: no watermarks."
            })
          }
        }
      ]
    }), { status: 200 }), async () => {
    const planner = new OpenRouterPromptPlanner({ apiKey: "test-key", model: "test-model", timeoutMs: 1000 });
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

    assert.equal(plan.model, "test-model");
    assert.match(plan.prompt, /Russian source language policy/i);
    assert.match(plan.prompt, /every visible text element in Russian only/i);
    assert.match(plan.prompt, /UI fragments, product labels and decorative words/i);
    assert.match(plan.prompt, /Do not add English words, Latin letters/i);
  });
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

async function withFetch<T>(fetcher: typeof fetch, action: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
