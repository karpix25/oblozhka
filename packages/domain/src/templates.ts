import type { ProjectPlatform } from "./types.js";
import { VERTICAL_STYLE_PROFILES } from "./verticalStyleProfiles.js";
import { YOUTUBE_STYLE_PROFILES } from "./youtubeStyleProfiles.js";

export type TemplateDefinition = {
  slug: string;
  title: string;
  platform: ProjectPlatform;
  previewImageUrl?: string;
  promptRules: string;
  sortOrder: number;
};

type TemplateStyleProfile = {
  slug: string;
  title: string;
  semanticMechanic: string;
  composition: { layout: string };
  textSystem: { role: string; placement: string; typography: string; maxWords: number };
  visualRules: string[];
  promptRules: string[];
  negativeRules: string[];
};

function profileTemplates(
  profiles: TemplateStyleProfile[],
  platform: ProjectPlatform,
  startOrder = 10
): TemplateDefinition[] {
  return profiles.map((profile, index) => ({
    slug: profile.slug,
    title: profile.title,
    platform,
    previewImageUrl: `templates/${profile.slug}.png`,
    promptRules: [
      `Hook mechanic: ${profile.semanticMechanic}`,
      `Layout: ${profile.composition.layout}`,
      `Text policy: ${profile.textSystem.role} ${profile.textSystem.placement} ${profile.textSystem.typography}`,
      `Max text words: ${profile.textSystem.maxWords}`,
      `Visual rules: ${profile.visualRules.join("; ")}`,
      `Prompt rules: ${profile.promptRules.join("; ")}`,
      `Avoid: ${profile.negativeRules.join("; ")}`
    ].join("\n"),
    sortOrder: startOrder + index * 10
  }));
}

const youtubeReferenceTemplates = profileTemplates(YOUTUBE_STYLE_PROFILES, "YOUTUBE");
const verticalReferenceTemplates = profileTemplates(VERTICAL_STYLE_PROFILES, "INSTAGRAM_TIKTOK");

export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  ...youtubeReferenceTemplates,
  ...verticalReferenceTemplates,
  {
    slug: "faceless-pov",
    title: "Faceless POV",
    platform: "FACELESS",
    promptRules: "First-person perspective, strong foreground action, large emotional text, creator face is not needed.",
    sortOrder: 210
  },
  {
    slug: "foreground-focus",
    title: "Foreground Focus",
    platform: "INSTAGRAM_TIKTOK",
    promptRules: "One close foreground object, shallow depth, short headline, vertical-friendly composition.",
    sortOrder: 220
  },
  {
    slug: "center-object-text",
    title: "Center Object Text",
    platform: "FACELESS",
    promptRules: "Clean central object with text around it; minimal background; premium product-like composition.",
    sortOrder: 230
  },
  {
    slug: "split-compare",
    title: "Split Compare",
    platform: "INSTAGRAM_TIKTOK",
    promptRules: "Before/after split screen, clear contrast, two labels, immediate transformation story.",
    sortOrder: 240
  }
];
