import { designRequiresGuestFace } from "./designConstraints.js";
import { isTemplateCompatibleWithPlatform } from "./projectTemplateCompatibility.js";
import type { ProjectPlatform } from "./types.js";

export type RecommendableTemplate = {
  slug: string;
  title: string;
  platform: ProjectPlatform;
  promptRules: string;
  sortOrder: number;
};

export type RecommendTemplatesInput = {
  platform: ProjectPlatform;
  topicText?: string | null;
  guestFaceAvailable?: boolean;
  limit?: number;
};

export type TemplateRecommendation<T extends RecommendableTemplate = RecommendableTemplate> = {
  template: T;
  score: number;
  reason: "TOPIC_MATCH" | "SINGLE_FACE_FRIENDLY" | "VERSATILE";
};

const STOP_WORDS = new Set([
  "and", "the", "with", "from", "this", "that", "your", "you", "for",
  "без", "для", "из", "как", "на", "по", "про", "что", "это"
]);

/**
 * Produces stable, explainable recommendations. Compatibility is a hard filter;
 * topic overlap and face requirements only affect ranking within that platform.
 */
export function recommendTemplates<T extends RecommendableTemplate>(
  templates: readonly T[],
  input: RecommendTemplatesInput
): TemplateRecommendation<T>[] {
  const topicTokens = tokenize(input.topicText ?? "");

  return templates
    .filter((template) => isTemplateCompatibleWithPlatform(input.platform, template))
    .map((template) => scoreTemplate(template, topicTokens, Boolean(input.guestFaceAvailable)))
    .sort((left, right) =>
      right.score - left.score ||
      left.template.sortOrder - right.template.sortOrder ||
      left.template.slug.localeCompare(right.template.slug)
    )
    .slice(0, Math.max(0, input.limit ?? 3));
}

function scoreTemplate<T extends RecommendableTemplate>(
  template: T,
  topicTokens: Set<string>,
  guestFaceAvailable: boolean
): TemplateRecommendation<T> {
  const searchableTokens = tokenize(`${template.slug} ${template.title} ${template.promptRules}`);
  const overlap = [...topicTokens].filter((token) => searchableTokens.has(token)).length;
  const requiresGuest = designRequiresGuestFace(template);
  const faceScore = requiresGuest && !guestFaceAvailable ? -100 : requiresGuest ? 5 : 10;
  const score = overlap * 20 + faceScore;

  return {
    template,
    score,
    reason: overlap > 0 ? "TOPIC_MATCH" : !requiresGuest ? "SINGLE_FACE_FRIENDLY" : "VERSATILE"
  };
}

function tokenize(value: string) {
  return new Set(
    value
      .toLocaleLowerCase("ru")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  );
}
