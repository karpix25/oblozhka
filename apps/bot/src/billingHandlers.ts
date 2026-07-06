import {
  completePlategaPayment,
  createPendingPlategaPayment,
  getBillingAccess,
  listActivePackages,
  prisma,
  upsertTelegramUser
} from "@covers/db";
import { encodePaymentPayload, PlategaClient } from "@covers/payments";
import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { randomUUID } from "node:crypto";
import { balanceMessage, paymentSuccessMessage, tariffPackagesKeyboard } from "./billingMessages.js";
import { tariffsMessage } from "./compliance.js";
import { deleteCallbackMessage } from "./navigation.js";
import { balanceKeyboard, backHomeKeyboard, tariffsKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

const platega = new PlategaClient();

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

    const payload = encodePaymentPayload({ packageId, userId: user.id, nonce: randomUUID() });
    const transaction = await platega.createTransaction({
      amountRub: pack.priceRub,
      description: pack.title,
      returnUrl: paymentReturnUrl("success"),
      failedUrl: paymentReturnUrl("failed"),
      payload,
      metadata: { userId: user.id, userName: user.username ?? undefined }
    });
    await createPendingPlategaPayment(prisma, {
      userId: user.id,
      packageId,
      payload,
      amountRub: pack.priceRub,
      credits: pack.credits,
      providerTransactionId: transaction.transactionId,
      providerStatus: transaction.status,
      paymentUrl: transaction.url,
      raw: transaction.raw as object
    });

    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(`Ссылка на оплату тарифа «${pack.title}» на ${pack.priceRub} ₽ готова.`, {
      reply_markup: paymentKeyboard(transaction.url, transaction.transactionId)
    });
  });

  bot.callbackQuery(/^payment:check:(.+)$/, async (ctx) => {
    const transactionId = ctx.match[1];
    const status = await platega.getTransaction(transactionId);
    if (status.status === "CONFIRMED") {
      const payment = await completePlategaPayment(prisma, {
        providerTransactionId: status.id,
        providerStatus: status.status,
        amountRub: status.amount,
        currency: status.currency,
        raw: status.raw as object
      });
      const access = await getBillingAccess(prisma, payment!.userId);
      await ctx.answerCallbackQuery("Оплата найдена.");
      await ctx.reply(paymentSuccessMessage(access));
      return;
    }
    await ctx.answerCallbackQuery("Оплата пока не подтверждена.");
  });
}

function paymentKeyboard(url: string, transactionId: string) {
  return new InlineKeyboard()
    .url("💳 Оплатить", url)
    .row()
    .text("🔄 Проверить оплату", `payment:check:${transactionId}`)
    .row()
    .text("🏠 В начало", "home");
}

function paymentReturnUrl(result: "success" | "failed") {
  const base = process.env.PAYMENT_RETURN_URL ?? process.env.PUBLIC_BOT_URL ?? "https://t.me/karpix_oblozhka_bot";
  return `${base}${base.includes("?") ? "&" : "?"}payment=${result}`;
}
