import {
  completeStarsPayment,
  createGeneration,
  createPendingPayment,
  findUserByTelegramId,
  listActivePackages,
  prisma,
  seedDefaultTemplates,
  upsertTelegramUser
} from "@covers/db";
import type { CoverFormat, ReferenceMode, WizardInput } from "@covers/domain";
import {
  createStarsInvoice,
  encodeInvoicePayload,
  normalizeSuccessfulPayment,
  TELEGRAM_STARS_CURRENCY
} from "@covers/telegram-payments";
import { Bot, session } from "grammy";
import { randomUUID } from "node:crypto";
import {
  confirmKeyboard,
  formatKeyboard,
  mainKeyboard,
  nicheKeyboard,
  packagesKeyboard,
  referenceModeKeyboard,
  styleKeyboard,
} from "./keyboards.js";
import {
  confirmationMessage,
  hookPrompt,
  howItWorksMessage,
  referencePrompt,
  supportMessage,
  termsMessage,
  topicPrompt
} from "./messages.js";
import { deleteCallbackMessage } from "./navigation.js";
import { sendOnboarding } from "./onboarding.js";
import { handleProjectPhoto, handleProjectText, registerProjectHandlers } from "./projectHandlers.js";
import { generationJobId, generationQueue } from "./queue.js";
import { type BotContext, initialSession, resetWizard } from "./session.js";
import { profileFromContext } from "./userProfile.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required.");
}

const bot = new Bot<BotContext>(token);
bot.use(session({ initial: initialSession }));
await seedDefaultTemplates(prisma);
registerProjectHandlers(bot, token);

bot.command("start", async (ctx) => {
  await upsertTelegramUser(prisma, profileFromContext(ctx));
  await sendOnboarding(ctx, ctx.from?.first_name);
});

bot.command("terms", async (ctx) => ctx.reply(termsMessage()));
bot.command("support", async (ctx) => ctx.reply(supportMessage()));
bot.command("paysupport", async (ctx) => ctx.reply(supportMessage()));

bot.callbackQuery("balance", async (ctx) => {
  const user = await findUserByTelegramId(prisma, ctx.from.id);
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(`Ваш баланс: ${user?.balance ?? 0} кредитов`);
});

bot.callbackQuery("support", async (ctx) => {
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(supportMessage());
});

bot.callbackQuery("home", async (ctx) => {
  resetWizard(ctx);
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await sendOnboarding(ctx, ctx.from.first_name);
});

bot.callbackQuery("how", async (ctx) => {
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(howItWorksMessage(), { reply_markup: mainKeyboard() });
});

bot.callbackQuery("packages", async (ctx) => {
  const packages = await listActivePackages(prisma);
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  if (packages.length === 0) {
    await ctx.reply("Пакеты кредитов пока не настроены.");
    return;
  }
  await ctx.reply("Выберите пакет:", { reply_markup: packagesKeyboard(packages) });
});

bot.callbackQuery(/^buy:(.+)$/, async (ctx) => {
  const packageId = ctx.match[1];
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const pack = await prisma.creditPackage.findUnique({ where: { id: packageId } });
  if (!pack || !pack.isActive) {
    await ctx.answerCallbackQuery("Пакет недоступен.");
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
  const refreshed = await findUserByTelegramId(prisma, ctx.from!.id);
  await ctx.reply(`Оплата прошла. Баланс: ${refreshed?.balance ?? 0} кредитов`);
});

bot.callbackQuery("generate:start", async (ctx) => {
  resetWizard(ctx);
  ctx.session.draft = {};
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply("Выберите основу для обложки:", { reply_markup: referenceModeKeyboard() });
});

bot.callbackQuery(/^quick:(YOUTUBE|VERTICAL)$/, async (ctx) => {
  resetWizard(ctx);
  ctx.session.draft = { format: ctx.match[1] as CoverFormat };
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply("Выберите основу для обложки:", { reply_markup: referenceModeKeyboard() });
});

bot.callbackQuery("refmode:SOON", async (ctx) => {
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply("Для текущей модели нужен стартовый образ. Выберите «С моим фото» или «По референсу».", {
    reply_markup: referenceModeKeyboard()
  });
});

bot.callbackQuery(/^refmode:(FACE|REFERENCE|NONE)$/, async (ctx) => {
  const referenceMode = ctx.match[1] as ReferenceMode;
  ctx.session.draft = { ...ctx.session.draft, referenceMode };
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);

  if (referenceMode === "NONE") {
    await askFormatOrTopic(ctx);
    return;
  }

  ctx.session.step = "referenceUpload";
  await ctx.reply(referencePrompt(referenceMode));
});

bot.callbackQuery(/^format:(YOUTUBE|VERTICAL)$/, async (ctx) => {
  ctx.session.draft = { ...ctx.session.draft, format: ctx.match[1] as CoverFormat };
  ctx.session.step = "topic";
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(topicPrompt());
});

bot.callbackQuery(/^niche:(.+)$/, async (ctx) => {
  ctx.session.draft = { ...ctx.session.draft, niche: ctx.match[1] };
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply("Выберите стиль:", { reply_markup: styleKeyboard() });
});

bot.callbackQuery(/^style:(.+)$/, async (ctx) => {
  ctx.session.draft = { ...ctx.session.draft, style: ctx.match[1] };
  ctx.session.step = "hook";
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(hookPrompt());
});

bot.on("message:photo", async (ctx) => {
  if (await handleProjectPhoto(ctx, token)) return;

  if (ctx.session.step !== "referenceUpload") {
    await ctx.reply("Фото получил. Чтобы использовать его для обложки, нажмите «Создать обложку».", {
      reply_markup: mainKeyboard()
    });
    return;
  }

  const photo = ctx.message.photo.at(-1);
  if (!photo) {
    await ctx.reply("Не получилось прочитать фото. Попробуйте отправить изображение ещё раз.");
    return;
  }

  const file = await ctx.api.getFile(photo.file_id);
  if (!file.file_path) {
    await ctx.reply("Telegram не вернул путь к файлу. Попробуйте другое фото.");
    return;
  }

  ctx.session.draft = {
    ...ctx.session.draft,
    referenceImageUrl: `https://api.telegram.org/file/bot${token}/${file.file_path}`
  };
  ctx.session.step = "idle";
  await askFormatOrTopic(ctx);
});

bot.on("message:text", async (ctx) => {
  if (await handleProjectText(ctx)) return;

  if (ctx.session.step === "topic") {
    const topic = ctx.message.text.trim();
    if (topic.length < 5) {
      await ctx.reply("Тема слишком короткая. Напишите чуть конкретнее: о чём ролик и в чём интрига?");
      return;
    }
    ctx.session.draft = { ...ctx.session.draft, topic };
    ctx.session.step = "idle";
    await ctx.reply("Шаг 4 из 5. Выберите нишу:", { reply_markup: nicheKeyboard() });
    return;
  }

  if (ctx.session.step === "hook") {
    const hookText = ctx.message.text.trim() === "-" ? undefined : ctx.message.text.trim();
    const draft = { ...ctx.session.draft, hookText };
    if (!isWizardInput(draft)) {
      resetWizard(ctx);
      await ctx.reply("Не хватило данных. Начните заново.", { reply_markup: mainKeyboard() });
      return;
    }
    ctx.session.draft = draft;
    ctx.session.step = "idle";
    await ctx.reply(confirmationMessage(draft), { reply_markup: confirmKeyboard() });
  }
});


bot.callbackQuery("confirm:generate", async (ctx) => {
  const draft = ctx.session.draft;
  if (!isWizardInput(draft)) {
    await ctx.answerCallbackQuery("Начните генерацию заново.");
    return;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  try {
    const chargeCredits = process.env.FREE_GENERATION_MODE === "false";
    const generation = await createGeneration(prisma, {
      userId: user.id,
      wizard: draft,
      prompt: "Prompt will be planned by OpenRouter in the worker.",
      chargeCredits
    });
    await generationQueue.add("generate-cover", { generationId: generation.id, userTelegramId: ctx.from.id }, { jobId: generationJobId(generation.id) });
    resetWizard(ctx);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Задача отправлена в генерацию. Обычно это занимает до минуты.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать генерацию.";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(message === "Insufficient credits." ? "Недостаточно кредитов. Пополните баланс." : message);
  }
});

function isWizardInput(value: Partial<WizardInput> | undefined): value is WizardInput {
  return Boolean(value?.format && value.referenceMode && value.topic && value.niche && value.style);
}

async function askFormatOrTopic(ctx: BotContext) {
  if (!ctx.session.draft?.format) {
    await ctx.reply("Шаг 2 из 5. Выберите формат:", { reply_markup: formatKeyboard() });
    return;
  }
  ctx.session.step = "topic";
  await ctx.reply(topicPrompt());
}

bot.start();
