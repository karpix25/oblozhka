import assert from "node:assert/strict";
import test from "node:test";
import { OpenRouterPromptPlanner } from "../packages/generation-ai/src/openrouter.js";
import { buildThumbnailHookPrompt } from "../packages/generation-ai/src/thumbnailHookPrompt.js";
import { countHookWords } from "../packages/generation-ai/src/hookText.js";

test("thumbnail hook prompt requests framework-based evidence-backed Russian candidates", () => {
  const prompt = buildThumbnailHookPrompt({
    transcript: "Реклама принесла 30 лидов, но продажи остановились из-за ошибки в воронке.",
    contentLanguage: "ru",
    platform: "YOUTUBE",
    theme: "Ошибки в рекламе",
    sourceTitle: "Как поднять продажи",
    templateConstraints: {
      maxWords: 4,
      summary: "Four words maximum"
    }
  });

  assert.match(prompt, /Верни ровно 14 разных кандидатов/);
  assert.match(prompt, /каждого angle ровно 2/);
  assert.match(prompt, /от 2 до 4 слов/);
  assert.match(prompt, /только русские слова кириллицей/);
  assert.match(prompt, /не повторяй и не пересказывай sourceTitle или theme/i);
  assert.match(prompt, /"evidence":"\.\.\."/);
});

test("successful hook generation filters weak variants and ranks locally", async () => {
  await withFetch(async () =>
    new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              hooks: [
                { text: "Как поднять продажи", angle: "specific_result", evidence: "Реклама принесла 30 лидов" },
                { text: "AI меняет продажи", angle: "specific_result", evidence: "Смешанный язык" },
                { text: "Смотри до конца", angle: "hidden_reason", evidence: "Пустая формула" },
                { text: "30 лидов без скидок", angle: "object_proof", evidence: "Реклама принесла 30 лидов" },
                { text: "Ошибка съедает продажи", angle: "mistake_cost", evidence: "Продажи остановились из-за ошибки" },
                { text: "Реклама работает наоборот", angle: "counterintuitive", evidence: "Ошибка возникла в воронке" },
                { text: "Что скрыла воронка", angle: "hidden_reason", evidence: "Проблема скрывалась в воронке" },
                { text: "Продажи остановила воронка", angle: "stakes", evidence: "Продажи остановились из-за ошибки в воронке" },
                { text: "Воронка до и после", angle: "visual_pair", evidence: "Ошибка возникла в воронке, продажи остановились" }
              ]
            })
          }
        }
      ]
    }), { status: 200 }), async () => {
    const planner = new OpenRouterPromptPlanner({
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 1000
    });
    const hooks = await planner.generateHooks({
      transcript: "Реклама принесла 30 лидов, но продажи остановились из-за ошибки в воронке.",
      platform: "YOUTUBE",
      contentLanguage: "ru",
      theme: "Ошибки в рекламе",
      sourceTitle: "Как поднять продажи"
    });

    assert.equal(hooks.length, 5);
    assert.ok(hooks.every((hook) => countHookWords(hook.text) >= 2 && countHookWords(hook.text) <= 5));
    assert.ok(hooks.every((hook) => !/[A-Za-z]/.test(hook.text)));
    assert.ok(hooks.every((hook) => hook.evidence));
    assert.ok(hooks.every((hook) => typeof hook.score === "number" && hook.score >= 0 && hook.score <= 100));
    assert.ok(!hooks.some((hook) => hook.text === "Как поднять продажи"));
    assert.ok(!hooks.some((hook) => hook.text === "Смотри до конца"));
    assert.equal(new Set(hooks.map((hook) => hook.angle)).size, 5);
  });
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
