import type { PromptPlanningInput } from "./types.js";

export function referenceRoleContract(input: PromptPlanningInput) {
  const roles = [
    "Reference image contract for Kie input_urls:",
    "Image 1: user's face or base visual. If it is a face, this is the identity source of truth: preserve the same person, facial geometry, skin tone, eyes, nose, mouth, hairline and recognizable proportions as closely as possible. Use it for identity/content only, not layout.",
    input.wizard.guestReferenceImageUrl
      ? "Image 2: guest face identity only, separate from the main person. Preserve this guest's facial identity separately and do not blend it with Image 1."
      : "No guest face image is provided.",
    input.templateReferenceImageUrl
      ? `${input.wizard.guestReferenceImageUrl ? "Image 3" : "Image 2"}: selected template preview. Use ONLY its composition skeleton, text zones, typography feel, color hierarchy and visual rhythm. Do not copy the template content, faces, facial features, hair, expressions, body identity or personal likeness from this template image.`
      : "Template preview image is not available; follow the written template rules strictly.",
    input.userStyle?.imageUrl
      ? "User style reference image: design-only source for composition rhythm, typography, color palette and text zones. It is never an identity source; do not borrow faces, facial features, hair, age, expression or personal likeness from it."
      : "No custom user style reference image is provided."
  ];

  roles.push(
    "Identity priority: when a face reference exists, never infer or borrow facial features from template/style references. Template/style references control layout and design only; Image 1 controls the main person's likeness."
  );

  return roles.join("\n");
}
