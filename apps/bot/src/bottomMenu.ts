import { findUserByTelegramId, listTemplates, prisma } from "@covers/db";
import { Keyboard } from "grammy";
import { openFaceLibrary } from "./faceLibrary.js";
import { mainKeyboard, sourceTypeKeyboard } from "./keyboards.js";
import { howItWorksMessage, sourceStartMessage, supportMessage } from "./messages.js";
import { sendProjectList } from "./projectList.js";
import { resetWizard, type BotContext } from "./session.js";
import { sendTemplateGallery } from "./templateGallery.js";

const menuLabels = {
  create: "🎨 Создать",
  templates: "🖼 Шаблоны",
  faces: "👤 Лица",
  projects: "📁 Проекты",
  balance: "💎 Баланс",
  help: "❓ Помощь"
} as const;

export function bottomMenuKeyboard() {
  return new Keyboard()
    .text(menuLabels.create)
    .text(menuLabels.templates)
    .row()
    .text(menuLabels.faces)
    .text(menuLabels.projects)
    .row()
    .text(menuLabels.balance)
    .text(menuLabels.help)
    .resized()
    .persistent()
    .placeholder("Выберите действие");
}

export async function handleBottomMenuText(ctx: BotContext) {
  const text = ctx.message?.text?.trim();
  if (!text || !(Object.values(menuLabels) as string[]).includes(text)) {
    return false;
  }

  if (text === menuLabels.create) {
    resetWizard(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
    return true;
  }

  if (text === menuLabels.templates) {
    ctx.session.templateGalleryMode = "browse";
    const templates = await listTemplates(prisma, "YOUTUBE");
    await sendTemplateGallery(ctx, templates, { mode: "browse", platform: "YOUTUBE" });
    return true;
  }

  if (text === menuLabels.faces) {
    await openFaceLibrary(ctx);
    return true;
  }

  if (text === menuLabels.projects) {
    await sendProjectList(ctx);
    return true;
  }

  if (text === menuLabels.balance) {
    const user = ctx.from ? await findUserByTelegramId(prisma, ctx.from.id) : null;
    await ctx.reply(`Доступно обложек: ${user?.balance ?? 0}`, { reply_markup: mainKeyboard() });
    return true;
  }

  await ctx.reply(howItWorksMessage(), { reply_markup: mainKeyboard() });
  await ctx.reply(supportMessage());
  return true;
}

export async function showBottomMenu(ctx: BotContext) {
  await ctx.reply("Быстрое меню включено снизу.", { reply_markup: bottomMenuKeyboard() });
}
