import type { WizardInput } from "@covers/domain";

export type PromptPlan = {
  prompt: string;
  referenceAnalysis?: string;
  model: string;
  validationIssues?: string[];
};

export type ImageGenerationInput = {
  prompt: string;
  imageUrl?: string;
  imageUrls?: string[];
  aspectRatio: string;
  resolution?: string;
};

export type ImageGenerationResult = {
  bytes: Buffer;
  model: string;
  raw: unknown;
};

export type PromptPlanningInput = {
  wizard: WizardInput;
  formatDescription: string;
  aspectRatio: string;
  template?: {
    slug?: string | null;
    title?: string | null;
    promptRules?: string | null;
  };
  templateReferenceImageUrl?: string;
};
