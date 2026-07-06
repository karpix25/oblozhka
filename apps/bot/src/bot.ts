import {
  createGeneration,
  prisma,
  seedDefaultTariffPackages,
  seedDefaultTemplates,
  upsertTelegramUser
} from "@covers/db";
import type { CoverFormat, ReferenceMode, WizardInput } from "@covers/domain";
import { Bot, session } from "grammy";
import { handleLegacyReplyMenuText, hideReplyMenu } from "./legacyReplyMenu.js";
import { createBotAbuseGuard } from "./abuseGuard.js";
import { documentsKeyboard, documentsMessage } from "./compliance.js";
import { enqueueGenerationOrCompensate } from "./generationQueueing.js";
import { insufficientCreditsMessage } from "./billingMessages.js";
import { registerBillingHandlers } from "./billingHandlers.js";
import {
  confirmKeyboard,
  formatKeyboard,
  nicheKeyboard,
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
import { faceCardQueue, generationQueue, hookQueue } from "./queue.js";
import { balanceKeyboard, backHomeKeyboard, insufficientCreditsKeyboard, projectsKeyboard } from "./sectionKeyboards.js";
import { type BotContext, initialSession, resetWizard } from "./session.js";
import { createBotSessionStorage } from "./sessionStorage.js";
import { startBotRuntime } from "./runtime.js";
import { profileFromContext } from "./userProfile.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required.");
}

const bot = new Bot<BotContext>(token);
const sessionStorage = createBotSessionStorage();
const abuseGuard = createBotAbuseGuard();
bot.use(session({ initial: initialSession, storage: sessionStorage.storage }));
await seedDefaultTemplates(prisma);
await seedDefaultTariffPackages(prisma);
registerBillingHandlers(bot);
registerProjectHandlers(bot, token, abuseGuard);

bot.command("start", async (ctx) => {
  await upsertTelegramUser(prisma, profileFromContext(ctx));
  await hideReplyMenu(ctx);
  await sendOnboarding(ctx, ctx.from?.first_name);
});

bot.command("terms", async (ctx) => ctx.reply(termsMessage(), { reply_markup: documentsKeyboard() }));
bot.command("docs", async (ctx) => ctx.reply(documentsMessage(), { reply_markup: documentsKeyboard() }));
bot.command("privacy", async (ctx) => ctx.reply(documentsMessage(), { reply_markup: documentsKeyboard() }));
bot.command("agreement", async (ctx) => ctx.reply(documentsMessage(), { reply_markup: documentsKeyboard() }));
bot.command("support", async (ctx) => ctx.reply(supportMessage(), { reply_markup: documentsKeyboard() }));
bot.command("paysupport", async (ctx) => ctx.reply(supportMessage(), { reply_markup: documentsKeyboard() }));

bot.callbackQuery("support", async (ctx) => {
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(supportMessage(), { reply_markup: documentsKeyboard() });
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
  await ctx.reply(howItWorksMessage(), { reply_markup: backHomeKeyboard() });
});

bot.callbackQuery("documents", async (ctx) => {
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(documentsMessage(), { reply_markup: documentsKeyboard() });
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
  await ctx.reply("Пока лучше начать с фото, кадра или референса. Так результат получается стабильнее.", {
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
  await ctx.reply(referencePrompt(referenceMode), { reply_markup: backHomeKeyboard() });
});

bot.callbackQuery(/^format:(YOUTUBE|VERTICAL)$/, async (ctx) => {
  ctx.session.draft = { ...ctx.session.draft, format: ctx.match[1] as CoverFormat };
  ctx.session.step = "topic";
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);
  await ctx.reply(topicPrompt(), { reply_markup: backHomeKeyboard() });
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
  await ctx.reply(hookPrompt(), { reply_markup: backHomeKeyboard() });
});

bot.on("message:photo", async (ctx) => {
  if (await handleProjectPhoto(ctx, token, abuseGuard)) return;

  if (ctx.session.step !== "referenceUpload") {
    await ctx.reply("Фото получил. Чтобы использовать его для обложки, нажмите «Создать обложку».", {
      reply_markup: projectsKeyboard()
    });
    return;
  }

  const photo = ctx.message.photo.at(-1);
  if (!photo) {
    await ctx.reply("Не получилось прочитать фото. Попробуйте отправить изображение ещё раз.");
    return;
  }
  if (!(await abuseGuard.consume(ctx, "asset-upload"))) {
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
  if (await handleLegacyReplyMenuText(ctx)) return;
  if (await handleProjectText(ctx, abuseGuard)) return;

  if (ctx.session.step === "topic") {
    const topic = ctx.message.text.trim();
    if (topic.length < 5) {
      await ctx.reply("Тема слишком короткая. Напишите чуть конкретнее: о чём ролик и в чём интрига?", {
        reply_markup: backHomeKeyboard()
      });
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
      await ctx.reply("Не хватило данных. Начните заново.", { reply_markup: backHomeKeyboard() });
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
  if (!(await abuseGuard.consume(ctx, "cover-generation"))) {
    return;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  try {
    const generation = await createGeneration(prisma, {
      userId: user.id,
      wizard: draft,
      prompt: "Prompt will be planned by OpenRouter in the worker.",
      chargeCredits: true
    });
    await enqueueGenerationOrCompensate(generation, ctx.from.id);
    resetWizard(ctx);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Принял задачу. Обычно обложка готова в течение минуты.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать генерацию.";
    const isInsufficientCredits = message === "Insufficient credits.";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(isInsufficientCredits ? insufficientCreditsMessage() : message, {
      reply_markup: isInsufficientCredits ? insufficientCreditsKeyboard() : balanceKeyboard()
    });
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
  await ctx.reply(topicPrompt(), { reply_markup: backHomeKeyboard() });
}

await startBotRuntime(bot, {
  onShutdown: async () => {
    await Promise.all([
      generationQueue.close(),
      hookQueue.close(),
      faceCardQueue.close(),
      sessionStorage.close(),
      Promise.resolve(abuseGuard.close()),
      prisma.$disconnect()
    ]);
  }
});
