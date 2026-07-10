import { DEFAULT_NICHES, DEFAULT_STYLES, FORMAT_SPECS, templateDisplayName, type ProjectPlatform } from "@covers/domain";
import type { BillingAccess } from "@covers/db";
import { InlineKeyboard } from "grammy";
import { customStyleMenuLabel, customStyleSourceLabel } from "./planUi.js";

export function mainKeyboard(access?: BillingAccess) {
  return new InlineKeyboard()
    .text("🎨 Создать обложку", "project:start")
    .row()
    .text("👤 Мои лица", "faces:mine")
    .text(customStyleMenuLabel(access), "styles:mine")
    .row()
    .text("🖼 Шаблоны", "templates:library")
    .row()
    .text("🖼 Мои обложки", "covers:mine")
    .text("💎 Баланс", "balance")
    .row()
    .text("💳 Тарифы", "tariffs")
    .text("❓ Как это работает", "how")
    .row()
    .text("💬 Поддержка", "support");
}

export function styleSourceKeyboard(access?: BillingAccess) {
  return new InlineKeyboard()
    .text("🖼 Библиотека шаблонов", "style-source:library")
    .row()
    .text(customStyleSourceLabel(access), "style-source:custom")
    .row()
    .text("⬅️ Назад", "project:back:platform")
    .text("🏠 В начало", "home");
}

export function sourceTypeKeyboard() {
  return new InlineKeyboard()
    .text("🔗 У меня есть ссылка", "source:LINK")
    .row()
    .text("📤 Загрузить видео", "source:VIDEO")
    .row()
    .text("📝 Вставить текст ролика", "source:TRANSCRIPT")
    .row()
    .text("🏠 В начало", "home");
}

export function platformKeyboard() {
  return new InlineKeyboard()
    .text("▶️ YouTube · 16:9", "platform:YOUTUBE")
    .row()
    .text("📱 Reels/TikTok · 9:16", "platform:INSTAGRAM_TIKTOK")
    .row()
    .text("⬅️ Назад", "project:back:source")
    .text("🏠 В начало", "home");
}

export function templatesKeyboard(
  templates: Array<{ id: string; title: string; slug: string; platform: ProjectPlatform }>
) {
  const keyboard = new InlineKeyboard();
  templates.forEach((template) => keyboard.text(templateDisplayName(template.slug, template.title), `template:${template.id}`).row());
  keyboard.text("🏠 В начало", "home");
  return keyboard;
}

export function referenceModeKeyboard() {
  return new InlineKeyboard()
    .text("👤 С моим лицом", "refmode:FACE")
    .row()
    .text("🖼 По кадру/референсу", "refmode:REFERENCE")
    .row()
    .text("✨ Без фото — скоро", "refmode:SOON")
    .row()
    .text("🏠 В начало", "home");
}

export function formatKeyboard() {
  return new InlineKeyboard()
    .text(FORMAT_SPECS.YOUTUBE.label, "format:YOUTUBE")
    .row()
    .text(FORMAT_SPECS.VERTICAL.label, "format:VERTICAL")
    .row()
    .text("🏠 В начало", "home");
}

export function nicheKeyboard() {
  const keyboard = new InlineKeyboard();
  DEFAULT_NICHES.forEach((niche, index) => {
    keyboard.text(niche, `niche:${niche}`);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });
  keyboard.row().text("🏠 В начало", "home");
  return keyboard;
}

export function styleKeyboard() {
  const keyboard = new InlineKeyboard();
  DEFAULT_STYLES.forEach((style, index) => {
    keyboard.text(style, `style:${style}`);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });
  keyboard.row().text("🏠 В начало", "home");
  return keyboard;
}

export function confirmKeyboard() {
  return new InlineKeyboard()
    .text("🚀 Собрать обложку", "confirm:generate")
    .row()
    .text("🔄 Начать заново", "project:start")
    .text("🏠 В начало", "home");
}
