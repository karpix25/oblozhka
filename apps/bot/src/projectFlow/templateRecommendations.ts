import { recommendTemplates, templateDisplayName, type ProjectPlatform } from "@covers/domain";
import { InlineKeyboard, InputFile } from "grammy";
import { templatePreviewPath } from "../assets.js";
import type { BotContext } from "../session.js";
import { trackProductEvent } from "./analytics.js";

type TemplateChoice = {
  id: string;
  slug: string;
  title: string;
  platform: ProjectPlatform;
  promptRules: string;
  sortOrder: number;
};

export function selectRecommendedTemplates(templates: TemplateChoice[], limit = 3) {
  return recommendTemplates(templates, { platform: templates[0]?.platform ?? "YOUTUBE", limit });
}

export async function sendTemplateRecommendations(
  ctx: BotContext,
  templates: TemplateChoice[],
  platform: ProjectPlatform,
  input: { topicText?: string | null; guestFaceAvailable?: boolean } = {}
) {
  const recommendations = recommendTemplates(templates, { platform, limit: 3, ...input });
  if (recommendations.length === 0) {
    await ctx.reply("Для этого формата пока нет готовых шаблонов.");
    return;
  }

  const keyboard = new InlineKeyboard();
  recommendations.forEach(({ template }, index) => {
    const prefix = index === 0 ? "⭐ Рекомендую" : `${index + 1}.`;
    keyboard.text(`${prefix} ${templateDisplayName(template.slug, template.title)}`, `template:${template.id}`).row();
  });
  keyboard
    .text("🖼 Показать все шаблоны", `templates:all:${platform}`)
    .row()
    .text("⬅️ Назад", "project:back:platform")
    .text("🏠 В начало", "home");

  const recommended = recommendations[0];
  trackProductEvent("templates_shown", {
    projectId: ctx.session.projectId,
    metadata: { platform, templateIds: recommendations.map(({ template }) => template.id) }
  });
  await ctx.replyWithPhoto(new InputFile(templatePreviewPath(recommended.template.slug)), {
    caption: `Подобрал 3 подходящих шаблона.\n\n⭐ Первый выбор: ${recommendationReason(recommended.reason)}`,
    reply_markup: keyboard
  });
}

function recommendationReason(reason: "TOPIC_MATCH" | "SINGLE_FACE_FRIENDLY" | "VERSATILE") {
  if (reason === "TOPIC_MATCH") return "лучше всего совпадает с темой ролика";
  if (reason === "SINGLE_FACE_FRIENDLY") return "хорошо работает с одним главным героем";
  return "универсальная композиция для быстрого старта";
}
