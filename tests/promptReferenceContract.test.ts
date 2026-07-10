import test from "node:test";
import assert from "node:assert/strict";
import { repairImagePrompt, validateImagePrompt } from "../packages/generation-ai/src/promptValidator.js";
import { referenceRoleContract } from "../packages/generation-ai/src/referenceContract.js";
import type { PromptPlanningInput } from "../packages/generation-ai/src/types.js";

test("reference role contract keeps face identity separate from template references", () => {
  const contract = referenceRoleContract(promptInput());

  assert.match(contract, /identity source of truth/i);
  assert.match(contract, /facial geometry/i);
  assert.match(contract, /never infer or borrow facial features/i);
  assert.match(contract, /Template\/style references control layout and design only/i);
});

test("reference role contract treats user style images as design only", () => {
  const contract = referenceRoleContract({
    ...promptInput(),
    userStyle: {
      title: "User style",
      promptRules: "Keep the same typography.",
      imageUrl: "https://example.com/style.png"
    }
  });

  assert.match(contract, /User style reference image/i);
  assert.match(contract, /design-only source/i);
  assert.match(contract, /never an identity source/i);
});

test("prompt repair block restores strict face identity rules", () => {
  const input = promptInput();
  const prompt = [
    "Create a YouTube thumbnail, aspect ratio 16:9.",
    "Selected template: Test Template (test-template).",
    "Large readable Russian cover text: \"ТЕСТ\".",
    "Use Image 1 as reference.",
    "Text zone on the left. Negative rules: no clutter."
  ].join("\n");

  const validation = validateImagePrompt(prompt, input);
  assert.equal(validation.ok, false);
  assert(validation.issues.includes("missing face identity preservation"));
  assert(validation.issues.includes("missing template face isolation"));

  const repaired = repairImagePrompt(prompt, input, validation.issues);
  assert.match(repaired, /same person recognizable/i);
  assert.match(repaired, /Do not borrow facial features/i);
});

function promptInput(): PromptPlanningInput {
  return {
    wizard: {
      format: "YOUTUBE",
      referenceMode: "FACE",
      referenceImageUrl: "https://example.com/person.png",
      topic: "Тестовая тема",
      niche: "education",
      hookText: "ТЕСТ",
      style: "Test Template"
    },
    formatDescription: "YouTube thumbnail",
    aspectRatio: "16:9",
    template: {
      slug: "test-template",
      title: "Test Template",
      promptRules: "Use a big face on the right and text on the left."
    },
    templateReferenceImageUrl: "https://example.com/template.png"
  };
}
