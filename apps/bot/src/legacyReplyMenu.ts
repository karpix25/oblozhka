import { getBillingAccess, listTemplates, prisma, upsertTelegramUser } from "@covers/db";
import { balanceMessage } from "./billingMessages.js";
import { documentsKeyboard, supportMessage, tariffsMessage } from "./compliance.js";
import { openFaceLibrary } from "./faceLibrary.js";
import { sourceTypeKeyboard } from "./keyboards.js";
import { sourceStartMessage } from "./messages.js";
import { openCoverHistory } from "./projectHandlers.js";
import { sendProjectList } from "./projectList.js";
import { balanceKeyboard, tariffsKeyboard } from "./sectionKeyboards.js";
import { menuIntentFromText } from "./menuIntent.js";
import { resetWizard, type BotContext } from "./session.js";
import { sendTemplateGallery } from "./templateGallery.js";
import { profileFromContext } from "./userProfile.js";
import { openStyleLibrary } from "./styleLibrary.js";

const removeReplyKeyboard = { remove_keyboard: true } as const;

export async function hideReplyMenu(ctx: BotContext) {
  const cleanupMessage = await ctx.reply("Обновляю меню.", {
    reply_markup: removeReplyKeyboard
  });
  await ctx.api.deleteMessage(ctx.chat!.id, cleanupMessage.message_id).catch(() => undefined);
}

export async function handleLegacyReplyMenuText(ctx: BotContext) {
  const intent = menuIntentFromText(ctx.message?.text);
  if (!intent) {
    return false;
  }

  if (intent === "create") {
    resetWizard(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
    return true;
  }

  if (intent === "templates") {
    ctx.session.templateGalleryMode = "browse";
    const templates = await listTemplates(prisma, "YOUTUBE");
    await sendTemplateGallery(ctx, templates, { mode: "browse", platform: "YOUTUBE" });
    return true;
  }

  if (intent === "faces") {
    await openFaceLibrary(ctx);
    return true;
  }

  if (intent === "styles") {
    await openStyleLibrary(ctx);
    return true;
  }

  if (intent === "projects") {
    await sendProjectList(ctx);
    return true;
  }

  if (intent === "covers") {
    await openCoverHistory(ctx);
    return true;
  }

  if (intent === "tariffs") {
    await ctx.reply(tariffsMessage(), { reply_markup: tariffsKeyboard() });
    return true;
  }

  if (intent === "documents" || intent === "help") {
    await ctx.reply(supportMessage(), { reply_markup: documentsKeyboard() });
    return true;
  }

  const user = ctx.from ? await upsertTelegramUser(prisma, profileFromContext(ctx)) : null;
  const access = user ? await getBillingAccess(prisma, user.id) : null;
  await ctx.reply(access ? balanceMessage(access) : "Не получилось прочитать баланс.", { reply_markup: balanceKeyboard() });
  return true;
}
