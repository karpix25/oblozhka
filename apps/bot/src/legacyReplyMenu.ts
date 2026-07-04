import { findUserByTelegramId, listTemplates, prisma } from "@covers/db";
import { documentsKeyboard, supportMessage, tariffsMessage } from "./compliance.js";
import { openFaceLibrary } from "./faceLibrary.js";
import { sourceTypeKeyboard } from "./keyboards.js";
import { sourceStartMessage } from "./messages.js";
import { sendProjectList } from "./projectList.js";
import { balanceKeyboard, tariffsKeyboard } from "./sectionKeyboards.js";
import { resetWizard, type BotContext } from "./session.js";
import { sendTemplateGallery } from "./templateGallery.js";

const legacyMenuLabels = {
  create: "🎨 Создать",
  templates: "🖼 Шаблоны",
  faces: "👤 Лица",
  projects: "📁 Проекты",
  tariffs: "💳 Тарифы",
  documents: "📄 Документы",
  balance: "💎 Баланс",
  help: "❓ Помощь"
} as const;

const removeReplyKeyboard = { remove_keyboard: true } as const;

export async function hideReplyMenu(ctx: BotContext) {
  const cleanupMessage = await ctx.reply("Обновляю меню.", {
    reply_markup: removeReplyKeyboard
  });
  await ctx.api.deleteMessage(ctx.chat!.id, cleanupMessage.message_id).catch(() => undefined);
}

export async function handleLegacyReplyMenuText(ctx: BotContext) {
  const text = ctx.message?.text?.trim();
  if (!text || !(Object.values(legacyMenuLabels) as string[]).includes(text)) {
    return false;
  }

  if (text === legacyMenuLabels.create) {
    resetWizard(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
    return true;
  }

  if (text === legacyMenuLabels.templates) {
    ctx.session.templateGalleryMode = "browse";
    const templates = await listTemplates(prisma, "YOUTUBE");
    await sendTemplateGallery(ctx, templates, { mode: "browse", platform: "YOUTUBE" });
    return true;
  }

  if (text === legacyMenuLabels.faces) {
    await openFaceLibrary(ctx);
    return true;
  }

  if (text === legacyMenuLabels.projects) {
    await sendProjectList(ctx);
    return true;
  }

  if (text === legacyMenuLabels.tariffs) {
    await ctx.reply(tariffsMessage(), { reply_markup: tariffsKeyboard() });
    return true;
  }

  if (text === legacyMenuLabels.documents || text === legacyMenuLabels.help) {
    await ctx.reply(supportMessage(), { reply_markup: documentsKeyboard() });
    return true;
  }

  const user = ctx.from ? await findUserByTelegramId(prisma, ctx.from.id) : null;
  await ctx.reply(`Доступно обложек: ${user?.balance ?? 0}`, { reply_markup: balanceKeyboard() });
  return true;
}
