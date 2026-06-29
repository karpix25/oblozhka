import type { WizardInput } from "@covers/domain";

export type PromptPlan = {
  prompt: string;
  referenceAnalysis?: string;
  model: string;
};

export type ImageGenerationInput = {
  prompt: string;
  imageUrl?: string;
  imageUrls?: string[];
  aspectRatio: string;
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
};
