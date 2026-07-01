import { templateDisplayName, type ProjectPlatform } from "@covers/domain";
import { InlineKeyboard, InputFile } from "grammy";
import { templatePreviewPath } from "./assets.js";
import { mainKeyboard } from "./keyboards.js";
import type { BotContext } from "./session.js";

type GalleryMode = "browse" | "select";

type TemplateCard = {
  id: string;
  slug: string;
  title: string;
  platform: ProjectPlatform;
  promptRules: string;
  previewImageUrl?: string | null;
};

const platformLabels: Record<ProjectPlatform, string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM_TIKTOK: "Instagram/TikTok",
  FACELESS: "Faceless"
};

export async function sendTemplateGallery(
  ctx: BotContext,
  templates: TemplateCard[],
  input: { mode: GalleryMode; platform: ProjectPlatform; page?: number; replace?: boolean }
) {
  if (templates.length === 0) {
    await ctx.reply("Для этой платформы шаблоны пока не настроены.", { reply_markup: mainKeyboard() });
    return;
  }

  const page = normalizePage(input.page ?? 0, templates.length);
  const template = templates[page];
  const keyboard = templateGalleryKeyboard({
    mode: input.mode,
    platform: input.platform,
    page,
    total: templates.length,
    templateId: template.id
  });

  if (input.replace) {
    await ctx.deleteMessage().catch(() => undefined);
  }

  await ctx.replyWithPhoto(new InputFile(templatePreviewPath(template.slug)), {
    caption: templateCaption(template, page, templates.length),
    reply_markup: keyboard
  });
}

function templateGalleryKeyboard(input: {
  mode: GalleryMode;
  platform: ProjectPlatform;
  page: number;
  total: number;
  templateId: string;
}) {
  const keyboard = new InlineKeyboard()
    .text(platformTab("YouTube", input.platform === "YOUTUBE"), "templates:browse:YOUTUBE:0")
    .text(platformTab("Reels/TikTok", input.platform === "INSTAGRAM_TIKTOK"), "templates:browse:INSTAGRAM_TIKTOK:0")
    .text(platformTab("Faceless", input.platform === "FACELESS"), "templates:browse:FACELESS:0")
    .row();

  if (input.total > 1) {
    keyboard
      .text("Назад", `templates:browse:${input.platform}:${input.page - 1}`)
      .text(`${input.page + 1}/${input.total}`, `templates:noop`)
      .text("Вперёд", `templates:browse:${input.platform}:${input.page + 1}`)
      .row();
  }

  if (input.mode === "select") {
    keyboard.text("Выбрать этот шаблон", `template:${input.templateId}`).row();
  } else {
    keyboard.text("Новый проект", "project:start").row();
  }

  keyboard.text("В начало", "home");
  return keyboard;
}

function templateCaption(template: TemplateCard, page: number, total: number) {
  return [
    `${platformLabels[template.platform]} · ${page + 1}/${total}`,
    "",
    templateDisplayName(template.slug, template.title)
  ].join("\n");
}

function platformTab(label: string, active: boolean) {
  return active ? `🟡 ${label}` : label;
}

function normalizePage(page: number, total: number) {
  if (page < 0) return total - 1;
  if (page >= total) return 0;
  return page;
}
