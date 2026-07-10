import assert from "node:assert/strict";
import test from "node:test";
import {
  buildThumbnailHookPrompt,
  normalizeHookFramework,
  THUMBNAIL_HOOK_FRAMEWORKS
} from "../packages/generation-ai/src/index.js";

test("thumbnail hook frameworks expose seven production angles", () => {
  assert.deepEqual(THUMBNAIL_HOOK_FRAMEWORKS, [
    "mistake_cost",
    "hidden_reason",
    "counterintuitive",
    "specific_result",
    "stakes",
    "object_proof",
    "visual_pair"
  ]);
});

test("thumbnail hook prompt names every framework and visual proof rules", () => {
  const prompt = buildThumbnailHookPrompt({
    transcript: "Реклама принесла 30 лидов, но продажи остановились из-за ошибки в воронке.",
    contentLanguage: "ru",
    platform: "YOUTUBE"
  });

  for (const framework of THUMBNAIL_HOOK_FRAMEWORKS) {
    assert.match(prompt, new RegExp(`angle="${framework}"`));
  }
  assert.match(prompt, /Верни ровно 14 разных кандидатов/);
  assert.match(prompt, /object_proof обязан называть видимый объект/);
  assert.match(prompt, /visual_pair обязан подразумевать визуальный контраст/);
});

test("framework aliases normalize old angle names deterministically", () => {
  assert.equal(normalizeHookFramework("result"), "specific_result");
  assert.equal(normalizeHookFramework("specificity"), "object_proof");
  assert.equal(normalizeHookFramework("contrast"), "visual_pair");
  assert.equal(normalizeHookFramework("not_real"), undefined);
});
