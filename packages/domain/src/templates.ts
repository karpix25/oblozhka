import type { ProjectPlatform } from "./types.js";

export type TemplateDefinition = {
  slug: string;
  title: string;
  platform: ProjectPlatform;
  previewImageUrl?: string;
  promptRules: string;
  sortOrder: number;
};

export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    slug: "faceless-pov",
    title: "Faceless POV",
    platform: "FACELESS",
    promptRules: "First-person perspective, strong foreground action, large emotional text, creator face is not needed.",
    sortOrder: 10
  },
  {
    slug: "split-text",
    title: "Split Text",
    platform: "YOUTUBE",
    promptRules: "Big text block on one side, visual proof or object on the other side, very high contrast.",
    sortOrder: 20
  },
  {
    slug: "double-focus-arrow",
    title: "Double Focus Arrow",
    platform: "YOUTUBE",
    promptRules: "Two focal objects connected by a bold arrow; make the relationship instantly understandable.",
    sortOrder: 30
  },
  {
    slug: "foreground-focus",
    title: "Foreground Focus",
    platform: "INSTAGRAM_TIKTOK",
    promptRules: "One close foreground object, shallow depth, short headline, vertical-friendly composition.",
    sortOrder: 40
  },
  {
    slug: "center-object-text",
    title: "Center Object Text",
    platform: "FACELESS",
    promptRules: "Clean central object with text around it; minimal background; premium product-like composition.",
    sortOrder: 50
  },
  {
    slug: "skewed-hero-text",
    title: "Skewed Hero Text",
    platform: "YOUTUBE",
    promptRules: "Large skewed cinematic text integrated into the scene, dramatic perspective and motion.",
    sortOrder: 60
  },
  {
    slug: "subject-circle-highlight",
    title: "Subject Circle Highlight",
    platform: "YOUTUBE",
    promptRules: "Hidden or small subject highlighted with a red circle; mystery and discovery angle.",
    sortOrder: 70
  },
  {
    slug: "split-compare",
    title: "Split Compare",
    platform: "INSTAGRAM_TIKTOK",
    promptRules: "Before/after split screen, clear contrast, two labels, immediate transformation story.",
    sortOrder: 80
  }
];
