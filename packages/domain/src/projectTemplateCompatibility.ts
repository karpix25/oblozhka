import type { ProjectPlatform } from "./types.js";

export type PlatformTemplate = {
  platform: ProjectPlatform;
  slug?: string | null;
};

export class ProjectTemplateCompatibilityError extends Error {
  readonly code = "PROJECT_TEMPLATE_PLATFORM_MISMATCH";

  constructor(
    readonly projectPlatform: ProjectPlatform,
    readonly templatePlatform: ProjectPlatform,
    readonly templateSlug?: string | null
  ) {
    super(
      `Template${templateSlug ? ` "${templateSlug}"` : ""} is for ${templatePlatform}, ` +
        `but the project is for ${projectPlatform}.`
    );
    this.name = "ProjectTemplateCompatibilityError";
  }
}

export function isTemplateCompatibleWithPlatform(
  projectPlatform: ProjectPlatform,
  template: PlatformTemplate
) {
  return projectPlatform === template.platform;
}

export function assertTemplateCompatibleWithPlatform(
  projectPlatform: ProjectPlatform,
  template: PlatformTemplate
) {
  if (!isTemplateCompatibleWithPlatform(projectPlatform, template)) {
    throw new ProjectTemplateCompatibilityError(projectPlatform, template.platform, template.slug);
  }
}
