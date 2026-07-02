import { DEFAULT_NICHES, DEFAULT_STYLES, FORMAT_SPECS, templateDisplayName, type ProjectPlatform } from "@covers/domain";
import { InlineKeyboard } from "grammy";

export function mainKeyboard() {
  return new InlineKeyboard()
    .text("🎨 Создать обложку", "project:start")
    .row()
    .text("👤 Мои лица", "faces:mine")
    .text("🖼 Шаблоны", "templates:library")
    .row()
    .text("📁 Мои проекты", "projects:mine")
    .text("💎 Баланс", "balance")
    .row()
    .text("💳 Тарифы", "tariffs")
    .text("📄 Документы", "documents")
    .row()
    .text("❓ Как это работает", "how")
    .row()
    .text("💬 Поддержка", "support");
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
    .text("▶️ YouTube", "platform:YOUTUBE")
    .row()
    .text("📱 Reels/TikTok", "platform:INSTAGRAM_TIKTOK")
    .row()
    .text("🎭 Faceless", "platform:FACELESS")
    .row()
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
    .text(FORMAT_SPECS.VERTICAL.label, "format:VERTICAL");
}

export function nicheKeyboard() {
  const keyboard = new InlineKeyboard();
  DEFAULT_NICHES.forEach((niche, index) => {
    keyboard.text(niche, `niche:${niche}`);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });
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
  return keyboard;
}

export function confirmKeyboard() {
  return new InlineKeyboard()
    .text("🚀 Собрать обложку", "confirm:generate")
    .row()
    .text("🔄 Начать заново", "project:start")
    .text("🏠 В начало", "home");
}

export function packagesKeyboard(packages: Array<{ id: string; title: string; starsPrice: number; credits: number }>) {
  const keyboard = new InlineKeyboard();
  packages.forEach((pack) => {
    keyboard.text(`${pack.title}: ${pack.credits} обложек за ${pack.starsPrice} ⭐`, `buy:${pack.id}`).row();
  });
  return keyboard;
}
