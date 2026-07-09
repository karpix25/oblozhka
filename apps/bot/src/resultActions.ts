import { createModernizedGeneration, findGeneration, getBillingAccess, prisma, upsertTelegramUser } from "@covers/db";
import {
  canUseEntitlement,
  getModernizationAction,
  modernizationActionLockedMessage,
  type ModernizationActionId
} from "@covers/domain";
import { InlineKeyboard, type Bot } from "grammy";
import type { BotAbuseGuard } from "./abuseGuard.js";
import { insufficientCreditsMessage } from "./billingMessages.js";
import { enqueueGenerationOrCompensate } from "./generationQueueing.js";
import { deleteCallbackMessage } from "./navigation.js";
import { balanceKeyboard, insufficientCreditsKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export function registerResultActionHandlers(bot: Bot<BotContext>, abuseGuard: BotAbuseGuard) {
  bot.callbackQuery(/^modernize:noop:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery("Выберите, что улучшить в обложке.");
  });

  bot.callbackQuery(/^modernize:([^:]+):(.+)$/, async (ctx) => {
    if (ctx.match[1] === "noop") {
      await ctx.answerCallbackQuery("Выберите, что улучшить в обложке.");
      return;
    }

    const action = getModernizationAction(ctx.match[1]);
    if (!action) {
      await ctx.answerCallbackQuery("Такой правки больше нет.");
      return;
    }

    const sourceGeneration = await findGeneration(prisma, ctx.match[2]);
    if (!sourceGeneration) {
      await ctx.answerCallbackQuery("Не нашёл эту обложку.");
      return;
    }
    if (sourceGeneration.user.telegramId !== BigInt(ctx.from.id)) {
      await ctx.answerCallbackQuery("Это не ваша обложка.");
      return;
    }
    if (sourceGeneration.status !== "SUCCEEDED" || !sourceGeneration.originalUrl) {
      await ctx.answerCallbackQuery("Эту обложку пока нельзя улучшить.");
      return;
    }
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const access = await getBillingAccess(prisma, user.id);
    const subject = access.kind === "subscription" ? { kind: "subscription" as const, plan: access.plan } : { kind: "trial" as const };
    if (!canUseEntitlement(subject, action.requiredFeature)) {
      await ctx.answerCallbackQuery();
      await ctx.reply(modernizationActionLockedMessage(action), {
        reply_markup: lockedModernizationKeyboard()
      });
      return;
    }
    if (!(await abuseGuard.consume(ctx, "cover-generation"))) {
      return;
    }

    try {
      const generation = await createModernizedGeneration(prisma, {
        sourceGenerationId: sourceGeneration.id,
        userId: user.id,
        actionId: action.id as ModernizationActionId,
        chargeCredits: true
      });
      await enqueueGenerationOrCompensate(generation, ctx.from.id);
      await ctx.answerCallbackQuery();
      await deleteCallbackMessage(ctx);
      await ctx.reply(`Принял. Сейчас ${action.queuedLabel} и пришлю новый вариант.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось запустить правку.";
      const isInsufficientCredits = message === "Insufficient credits.";
      await ctx.answerCallbackQuery();
      await ctx.reply(isInsufficientCredits ? insufficientCreditsMessage() : message, {
        reply_markup: isInsufficientCredits ? insufficientCreditsKeyboard() : balanceKeyboard()
      });
    }
  });
}

function lockedModernizationKeyboard() {
  return new InlineKeyboard().text("⭐ Выбрать тариф", "packages").row().text("💳 Все тарифы", "tariffs").text("🏠 В начало", "home");
}
