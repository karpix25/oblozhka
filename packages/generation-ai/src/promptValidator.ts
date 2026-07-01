import type { PromptPlanningInput } from "./types.js";

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
  if (input.templateReferenceImageUrl) {
    requireAny(normalized, ["template preview", "composition skeleton", "template image"], "template reference role", issues);
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
    "Reference roles: Image 1 is identity/base visual only; the template preview image is composition skeleton only.",
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
