import { DEFAULT_TEMPLATES, type ProjectPlatform, type TemplateDefinition } from "@covers/domain";
import type { DbClient } from "./client.js";

export async function seedDefaultTemplates(db: DbClient, templates: TemplateDefinition[] = DEFAULT_TEMPLATES) {
  for (const template of templates) {
    await db.template.upsert({
      where: { slug: template.slug },
      create: template,
      update: {
        title: template.title,
        platform: template.platform,
        previewImageUrl: template.previewImageUrl,
        promptRules: template.promptRules,
        sortOrder: template.sortOrder,
        isActive: true
      }
    });
  }
}

export async function listTemplates(db: DbClient, platform?: ProjectPlatform) {
  return db.template.findMany({
    where: { isActive: true, platform },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }]
  });
}

export async function findTemplateBySlug(db: DbClient, slug: string) {
  return db.template.findUnique({ where: { slug } });
}
