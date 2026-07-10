import type { PromptPlanningInput } from "./types.js";
import { requiresRussianVisualLanguage } from "./languagePrompt.js";

export type PromptValidationResult = {
  ok: boolean;
  issues: string[];
};

export function validateImagePrompt(prompt: string, input: PromptPlanningInput): PromptValidationResult {
  const issues: string[] = [];
  const normalized = prompt.toLowerCase();

  requireIncludes(normalized, input.aspectRatio.toLowerCase(), "aspect ratio", issues);
  if (input.template?.title) requireIncludes(normalized, input.template.title.toLowerCase(), "template title", issues);
  if (input.template?.slug) requireIncludes(normalized, input.template.slug.toLowerCase(), "template slug", issues);
  if (input.wizard.hookText) requireIncludes(normalized, input.wizard.hookText.toLowerCase(), "hook text", issues);
  requireAny(normalized, ["image 1", "reference image 1", "uploaded face"], "image 1 role", issues);
  if (input.wizard.referenceMode === "FACE") {
    requireAny(normalized, ["identity source of truth", "same person", "recognizable", "likeness"], "face identity preservation", issues);
    requireAny(normalized, ["do not borrow facial features", "never infer or borrow facial features", "template/style references control layout"], "template face isolation", issues);
  }
  if (input.templateReferenceImageUrl) {
    requireAny(normalized, ["template preview", "composition skeleton", "template image"], "template reference role", issues);
  }
  if (input.wizard.guestReferenceImageUrl) {
    requireAny(normalized, ["guest face", "image 2", "second uploaded face"], "guest face role", issues);
  }
  if (input.userStyle?.imageUrl) {
    requireAny(normalized, ["user style reference", "custom style reference", "style reference"], "user style reference role", issues);
  }
  if (requiresRussianVisualLanguage(input)) {
    requireAny(
      normalized,
      ["russian only", "только на русском", "all visible text", "весь видимый текст", "no english words"],
      "Russian visual language policy",
      issues
    );
  }
  requireAny(normalized, ["negative", "avoid", "do not", "no "], "negative rules", issues);
  requireAny(normalized, ["text zone", "text placement", "headline placement", "typography"], "text placement/typography", issues);

  return { ok: issues.length === 0, issues };
}

export function repairImagePrompt(prompt: string, input: PromptPlanningInput, issues: string[]) {
  if (issues.length === 0) return prompt;
  return [
    prompt.trim(),
    "",
    "Mandatory repair block:",
    `Aspect ratio: ${input.aspectRatio}.`,
    input.template?.title ? `Selected template: ${input.template.title} (${input.template.slug ?? "unknown slug"}).` : "",
    input.wizard.hookText ? `Exact cover text policy: use the hook text "${input.wizard.hookText}" exactly unless the template says no overlay text.` : "",
    input.designText?.summary ? `Typography contract: ${input.designText.summary}` : "",
    "Reference roles: Image 1 is the identity source of truth for the main person; keep the same person recognizable and preserve facial geometry, skin tone, eyes, nose, mouth, hairline and proportions as closely as possible.",
    input.wizard.guestReferenceImageUrl ? "Guest face role: use Image 2 as a separate second person only; do not blend guest identity with Image 1." : "",
    input.userStyle?.imageUrl ? "User style reference role: use the custom style reference for layout, typography, color and text zones only, never for identity." : "",
    requiresRussianVisualLanguage(input)
      ? "Russian source language policy: render all visible text, labels, badges, buttons, signs and decorative words in Russian only. Do not add English words, transliteration or pseudo-text."
      : "",
    "Template/style references control layout and design only. Do not borrow facial features, hair, expression, age, ethnicity or personal likeness from template/style references.",
    "Preserve text zones, typography feel, subject/object placement, color hierarchy, foreground/background depth.",
    "Negative rules: avoid clutter, tiny unreadable text, extra logos, watermarks, unrelated objects, and changing the selected template layout.",
    `Validation issues repaired: ${issues.join(", ")}.`
  ].filter(Boolean).join("\n");
}

function requireIncludes(value: string, expected: string, label: string, issues: string[]) {
  if (expected && !value.includes(expected)) issues.push(`missing ${label}`);
}

function requireAny(value: string, expected: string[], label: string, issues: string[]) {
  if (!expected.some((item) => value.includes(item))) issues.push(`missing ${label}`);
}
