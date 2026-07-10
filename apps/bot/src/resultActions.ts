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
import { entitlementSubjectForAccess } from "./planUi.js";
import { balanceKeyboard, insufficientCreditsKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { startStyleUpload } from "./styleLibrary.js";
import { profileFromContext } from "./userProfile.js";

export function registerResultActionHandlers(bot: Bot<BotContext>, abuseGuard: BotAbuseGuard) {
  bot.callbackQuery(/^modernize:([^:]+):(.+)$/, async (ctx) => {
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
    const subject = entitlementSubjectForAccess(access);
    if (!canUseEntitlement(subject, action.requiredFeature)) {
      await ctx.answerCallbackQuery();
      await ctx.reply(modernizationActionLockedMessage(action), {
        reply_markup: lockedModernizationKeyboard()
      });
      return;
    }

    if (action.id === "replicate_template") {
      await startStyleUpload(ctx, {
        deleteSourceMessage: false,
        prompt: [
          "Загрузите обложку или скрин, шаблон которого хотите повторять.",
          "",
          "Я сохраню его как ваш стиль: композицию, контраст, цветовую логику, типографику и зоны текста. Потом этот стиль можно выбирать для новых обложек."
        ].join("\n")
      });
      return;
    }

    ctx.session.step = "modernizationPrompt";
    ctx.session.modernization = { generationId: sourceGeneration.id, actionId: action.id };
    await ctx.answerCallbackQuery();
    await ctx.reply(customEditPromptMessage(), { reply_markup: new InlineKeyboard().text("🏠 В начало", "home") });
  });
}

export async function handleResultActionText(ctx: BotContext, abuseGuard: BotAbuseGuard) {
  if (ctx.session.step !== "modernizationPrompt" || !ctx.session.modernization) {
    return false;
  }

  const instruction = ctx.message?.text?.trim() ?? "";
  if (instruction.length < 5) {
    await ctx.reply("Напишите чуть подробнее, что именно изменить в обложке.", {
      reply_markup: new InlineKeyboard().text("🏠 В начало", "home")
    });
    return true;
  }

  const action = getModernizationAction(ctx.session.modernization.actionId);
  const sourceGeneration = await findGeneration(prisma, ctx.session.modernization.generationId);
  if (!action || !sourceGeneration || sourceGeneration.status !== "SUCCEEDED" || !sourceGeneration.originalUrl) {
    ctx.session.step = "idle";
    ctx.session.modernization = undefined;
    await ctx.reply("Эту обложку уже нельзя изменить. Попробуйте создать новую.", {
      reply_markup: new InlineKeyboard().text("🎨 Создать обложку", "project:start")
    });
    return true;
  }
  if (sourceGeneration.user.telegramId !== BigInt(ctx.from!.id)) {
    ctx.session.step = "idle";
    ctx.session.modernization = undefined;
    await ctx.reply("Это не ваша обложка.");
    return true;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  const subject = entitlementSubjectForAccess(access);
  if (!canUseEntitlement(subject, action.requiredFeature)) {
    ctx.session.step = "idle";
    ctx.session.modernization = undefined;
    await ctx.reply(modernizationActionLockedMessage(action), {
      reply_markup: lockedModernizationKeyboard()
    });
    return true;
  }
  if (!(await abuseGuard.consume(ctx, "cover-generation"))) {
    return true;
  }

  try {
    const generation = await createModernizedGeneration(prisma, {
      sourceGenerationId: sourceGeneration.id,
      userId: user.id,
      actionId: action.id as ModernizationActionId,
      userInstruction: instruction,
      chargeOnSuccess: true
    });
    await enqueueGenerationOrCompensate(generation, ctx.from!.id);
    ctx.session.step = "idle";
    ctx.session.modernization = undefined;
    await ctx.reply("Принял правку. Кредит спишется только если генерация успешно вернёт новую картинку.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось запустить правку.";
    const isInsufficientCredits = message === "Insufficient credits.";
    await ctx.reply(isInsufficientCredits ? insufficientCreditsMessage() : message, {
      reply_markup: isInsufficientCredits ? insufficientCreditsKeyboard() : balanceKeyboard()
    });
  }
  return true;
}

function lockedModernizationKeyboard() {
  return new InlineKeyboard().text("⭐ Выбрать тариф", "packages").row().text("💳 Все тарифы", "tariffs").text("🏠 В начало", "home");
}

function customEditPromptMessage() {
  return [
    "Опишите, что изменить в этой обложке.",
    "",
    "Можно менять текст, фон, лицо, объект, цвета, композицию или любой другой элемент.",
    "Например: «замени текст на ...», «сделай фон темнее», «добавь красную стрелку справа», «убери лишний объект»."
  ].join("\n");
}
