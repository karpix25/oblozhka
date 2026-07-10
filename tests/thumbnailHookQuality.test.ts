import assert from "node:assert/strict";
import test from "node:test";
import { rankThumbnailHooks } from "../packages/generation-ai/src/thumbnailHookQuality.js";

const defaultContext = {
  transcript: "Реклама принесла 30 лидов, но продажи остановились из-за ошибки в воронке.",
  theme: "Ошибки в рекламе",
  keywords: ["реклама", "продажи", "лиды", "ошибка"],
  numbers: ["30"]
};

test("thumbnail hooks accept 2-5 words and reject 1 or 6+ words", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "Продажи", angle: "result", score: 90 },
      { text: "Реклама не работает", angle: "hidden_reason", score: 70 },
      { text: "30 лидов без бюджета", angle: "object_proof", score: 75 },
      { text: "Почему реклама больше не приносит клиентов", angle: "hidden_reason", score: 100 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Как исправить рекламную воронку",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 5
    }
  );

  assert.deepEqual(
    new Set(ranked.map((hook) => hook.text)),
    new Set(["Реклама не работает", "30 лидов без бюджета"])
  );
});

test("Russian mode rejects hooks containing Latin letters", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "AI меняет продажи", angle: "specific_result", score: 100 },
      { text: "ИИ меняет продажи", angle: "specific_result", score: 60 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Новая система продаж",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 5
    }
  );

  assert.deepEqual(ranked.map((hook) => hook.text), ["ИИ меняет продажи"]);
});

test("thumbnail hooks reject repetitions of source title and theme", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "КАК ПОДНЯТЬ ПРОДАЖИ!", angle: "specific_result", score: 100 },
      { text: "Ошибка в рекламе", angle: "mistake_cost", score: 95 },
      { text: "30 лидов без скидок", angle: "object_proof", score: 70 }
    ],
    {
      context: {
        ...defaultContext,
        theme: "Ошибка в рекламе"
      },
      sourceTitle: "Как поднять продажи",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 5
    }
  );

  assert.deepEqual(ranked.map((hook) => hook.text), ["30 лидов без скидок"]);
});

test("model score 100 does not rescue an irrelevant weak hook", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "Смотри до конца", angle: "curiosity", score: 100 },
      { text: "30 лидов без рекламы", angle: "object_proof", score: 35 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Разбор рекламной воронки",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 1
    }
  );

  assert.deepEqual(ranked.map((hook) => hook.text), ["30 лидов без рекламы"]);
});

test("transcript numbers and keywords boost the relevant hook", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "Ошибка мешает команде", angle: "mistake_cost", score: 50 },
      { text: "30 лидов из рекламы", angle: "object_proof", score: 50 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Почему остановились продажи",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 2
    }
  );

  assert.equal(ranked[0]?.text, "30 лидов из рекламы");
});

test("equal scores produce deterministic order independent of input order", () => {
  const hooks = [
    { text: "Продажи без скидок", angle: "stakes", score: 70 },
    { text: "Продажи после ошибки", angle: "mistake_cost", score: 70 },
    { text: "Продажи через контент", angle: "specific_result", score: 70 }
  ];
  const options = {
    context: defaultContext,
    sourceTitle: "Новая модель отдела продаж",
    contentLanguage: "ru" as const,
    maxWords: 5,
    limit: 3
  };

  const forward = rankThumbnailHooks(hooks, options).map((hook) => hook.text);
  const reversed = rankThumbnailHooks([...hooks].reverse(), options).map((hook) => hook.text);

  assert.deepEqual(forward, reversed);
});

test("final selection contains different hook angles when available", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "30 лидов без рекламы", angle: "object_proof", score: 95 },
      { text: "Продажи выросли на 30", angle: "specific_result", score: 90 },
      { text: "Ошибка съедает продажи", angle: "mistake_cost", score: 80 },
      { text: "Почему реклама не работает", angle: "hidden_reason", score: 75 },
      { text: "До и после рекламы", angle: "visual_pair", score: 70 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Разбор рекламной стратегии",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 4
    }
  );

  assert.equal(ranked.length, 4);
  assert.equal(new Set(ranked.map((hook) => hook.angle)).size, 4);
});

test("unsupported numbers are rejected even when model score is high", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "300 лидов из рекламы", angle: "object_proof", score: 100 },
      { text: "30 лидов из рекламы", angle: "object_proof", score: 70 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Разбор рекламной воронки",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 5
    }
  );

  assert.deepEqual(ranked.map((hook) => hook.text), ["30 лидов из рекламы"]);
});

test("required evidence rejects unsupported provider hooks", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "Ошибка съедает продажи", angle: "mistake_cost", evidence: "Общая фраза без фактов", score: 100 },
      { text: "Продажи остановила воронка", angle: "stakes", evidence: "Продажи остановились из-за ошибки в воронке", score: 60 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Разбор рекламной воронки",
      contentLanguage: "ru",
      maxWords: 5,
      requireEvidence: true,
      limit: 5
    }
  );

  assert.deepEqual(ranked.map((hook) => hook.text), ["Продажи остановила воронка"]);
});

test("visual pair framework is boosted for drawable contrasts", () => {
  const ranked = rankThumbnailHooks(
    [
      { text: "Реклама после ошибки", angle: "specific_result", score: 80 },
      { text: "Реклама до и после", angle: "visual_pair", score: 70 }
    ],
    {
      context: defaultContext,
      sourceTitle: "Разбор рекламной воронки",
      contentLanguage: "ru",
      maxWords: 5,
      limit: 2
    }
  );

  assert.equal(ranked[0]?.text, "Реклама до и после");
});
