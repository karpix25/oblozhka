import {
  completeStarsPayment,
  createPendingPayment,
  getBillingAccess,
  listActivePackages,
  prisma,
  upsertTelegramUser
} from "@covers/db";
import {
  createStarsInvoice,
  encodeInvoicePayload,
  normalizeSuccessfulPayment,
  TELEGRAM_STARS_CURRENCY
} from "@covers/telegram-payments";
import type { Bot } from "grammy";
import { randomUUID } from "node:crypto";
import { balanceMessage, paymentSuccessMessage, tariffPackagesKeyboard } from "./billingMessages.js";
import { tariffsMessage } from "./compliance.js";
import { deleteCallbackMessage } from "./navigation.js";
import { balanceKeyboard, backHomeKeyboard, tariffsKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export function registerBillingHandlers(bot: Bot<BotContext>) {
  bot.command("tariffs", async (ctx) => ctx.reply(tariffsMessage(), { reply_markup: tariffsKeyboard() }));

  bot.callbackQuery("balance", async (ctx) => {
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const access = await getBillingAccess(prisma, user.id);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(balanceMessage(access), { reply_markup: balanceKeyboard() });
  });

  bot.callbackQuery("tariffs", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(tariffsMessage(), { reply_markup: tariffsKeyboard() });
  });

  bot.callbackQuery("packages", async (ctx) => {
    const packages = await listActivePackages(prisma);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    if (packages.length === 0) {
      await ctx.reply("Тарифы пока не настроены.", { reply_markup: backHomeKeyboard("tariffs") });
      return;
    }
    await ctx.reply("Выберите тариф:", { reply_markup: tariffPackagesKeyboard(packages) });
  });

  bot.callbackQuery(/^buy:(.+)$/, async (ctx) => {
    const packageId = ctx.match[1];
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const pack = await prisma.creditPackage.findUnique({ where: { id: packageId } });
    if (!pack || !pack.isActive) {
      await ctx.answerCallbackQuery("Тариф недоступен.");
      return;
    }

    const payload = encodeInvoicePayload({ packageId, userId: user.id, nonce: randomUUID() });
    await createPendingPayment(prisma, {
      userId: user.id,
      packageId,
      payload,
      starsAmount: pack.starsPrice,
      credits: pack.credits
    });
    const invoice = createStarsInvoice({
      title: pack.title,
      description: pack.description ?? undefined,
      starsPrice: pack.starsPrice,
      credits: pack.credits,
      payload
    });

    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.api.sendInvoice(ctx.chat!.id, invoice.title, invoice.description, invoice.payload, invoice.currency, invoice.prices);
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = normalizeSuccessfulPayment(ctx.message.successful_payment);
    if (payment.currency !== TELEGRAM_STARS_CURRENCY) {
      await ctx.reply("Оплата получена в неподдерживаемой валюте. Напишите в поддержку.");
      return;
    }
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    await completeStarsPayment(prisma, { userId: user.id, payment });
    const access = await getBillingAccess(prisma, user.id);
    await ctx.reply(paymentSuccessMessage(access));
  });
}
