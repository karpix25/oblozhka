import type { PromptPlanningInput } from "./types.js";

export function referenceRoleContract(input: PromptPlanningInput) {
  const roles = [
    "Reference image contract for Kie input_urls:",
    "Image 1: user's face or base visual. Use for identity/content only, not layout.",
    input.wizard.guestReferenceImageUrl
      ? "Image 2: guest face identity only, separate from the main person."
      : "No guest face image is provided.",
    input.templateReferenceImageUrl
      ? `${input.wizard.guestReferenceImageUrl ? "Image 3" : "Image 2"}: selected template preview. Use ONLY its composition skeleton, text zones, typography feel, color hierarchy and visual rhythm. Do not copy the template content.`
      : "Template preview image is not available; follow the written template rules strictly."
  ];

  return roles.join("\n");
}
