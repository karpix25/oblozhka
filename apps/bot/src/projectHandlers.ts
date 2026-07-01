import {
  createGenerationFromProject,
  createProject,
  listTemplates,
  listUserProjects,
  prisma,
  selectBestProjectHook,
  selectProjectHook,
  setProjectPlatform,
  setProjectTemplate,
  upsertTelegramUser
} from "@covers/db";
import type { ProjectPlatform, SourceType } from "@covers/domain";
import type { Bot } from "grammy";
import { sendFaceLibrary } from "./faceLibrary.js";
import { mainKeyboard, platformKeyboard, sourceTypeKeyboard } from "./keyboards.js";
import { askGuestFace, requiresGuestFace, saveUploadedGuestFace, useSavedGuestFace } from "./guestFaceFlow.js";
import {
  platformPrompt,
  referenceForGenerationPrompt,
  sourcePrompt,
  sourceStartMessage,
} from "./messages.js";
import { deleteCallbackMessage } from "./navigation.js";
import { platformLabel, projectStatusLabel } from "./projectLabels.js";
import { generationJobId, generationQueue, hookJobId, hookQueue } from "./queue.js";
import { askReferenceForGeneration, saveUploadedReferenceFace, useSavedReferenceFace } from "./referenceFaceFlow.js";
import { type BotContext, resetWizard } from "./session.js";
import { sendTemplateGallery } from "./templateGallery.js";
import { profileFromContext } from "./userProfile.js";

export function registerProjectHandlers(bot: Bot<BotContext>, token: string) {
  bot.callbackQuery("project:start", async (ctx) => {
    resetWizard(ctx);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
  });

  bot.callbackQuery("projects:mine", async (ctx) => {
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const projects = await listUserProjects(prisma, user.id);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    if (projects.length === 0) {
      await ctx.reply("Пока нет проектов. Начните с кнопки «Создать обложку».", { reply_markup: mainKeyboard() });
      return;
    }
    await ctx.reply(
      projects
        .map((project, index) => `${index + 1}. ${platformLabel(project.platform)} · ${projectStatusLabel(project.status)} · ${project.selectedHook?.text ?? "текст еще не выбран"}`)
        .join("\n")
    );
  });

  bot.callbackQuery("faces:mine", async (ctx) => {
    await sendFaceLibrary(ctx);
  });

  bot.callbackQuery("templates:library", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    ctx.session.templateGalleryMode = "browse";
    const platform = "YOUTUBE";
    const templates = await listTemplates(prisma, platform);
    await sendTemplateGallery(ctx, templates, { mode: "browse", platform });
  });

  bot.callbackQuery(/^templates:browse:(YOUTUBE|INSTAGRAM_TIKTOK|FACELESS):(-?\d+)$/, async (ctx) => {
    const platform = ctx.match[1] as ProjectPlatform;
    const page = Number(ctx.match[2]);
    const templates = await listTemplates(prisma, platform);
    await ctx.answerCallbackQuery();
    await sendTemplateGallery(ctx, templates, {
      mode: ctx.session.templateGalleryMode ?? "browse",
      platform,
      page,
      replace: true
    });
  });

  bot.callbackQuery("templates:noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^source:(LINK|VIDEO|TRANSCRIPT)$/, async (ctx) => {
    const sourceType = ctx.match[1] as SourceType;
    ctx.session.step = sourceType === "LINK" ? "sourceLink" : sourceType === "VIDEO" ? "sourceVideo" : "sourceTranscript";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourcePrompt(sourceType));
  });

  bot.callbackQuery(/^platform:(YOUTUBE|INSTAGRAM_TIKTOK|FACELESS)$/, async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    const platform = ctx.match[1] as ProjectPlatform;
    await setProjectPlatform(prisma, ctx.session.projectId, platform);
    const templates = await listTemplates(prisma, platform);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    ctx.session.templateGalleryMode = "select";
    await sendTemplateGallery(ctx, templates, { mode: "select", platform });
  });

  bot.callbackQuery(/^template:(.+)$/, async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    const project = await setProjectTemplate(prisma, ctx.session.projectId, ctx.match[1]);
    ctx.session.templateGalleryMode = undefined;
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    if (requiresGuestFace(project.selectedTemplate)) {
      await askGuestFace(ctx);
      return;
    }
    await enqueueHooks(ctx);
  });

  bot.callbackQuery(/^guestface:use:(.+)$/, async (ctx) => {
    if (await useSavedGuestFace(ctx, ctx.match[1], token)) {
      await deleteCallbackMessage(ctx);
      await enqueueHooks(ctx);
    }
  });

  bot.callbackQuery("guestface:upload", async (ctx) => {
    ctx.session.step = "guestFaceUpload";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Загрузите фото второго человека для podcast countdown.");
  });

  async function enqueueHooks(ctx: BotContext) {
    if (!ctx.session.projectId) return;
    await hookQueue.add("generate-hooks", { projectId: ctx.session.projectId, userTelegramId: ctx.from!.id }, { jobId: hookJobId(ctx.session.projectId) });
    await ctx.reply("Анализирую ролик и готовлю варианты текста для обложки.");
  }

  bot.callbackQuery(/^hook:auto:(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    await selectBestProjectHook(prisma, projectId);
    ctx.session.projectId = projectId;
    await ctx.answerCallbackQuery("Выбрал лучший вариант.");
    await deleteCallbackMessage(ctx);
    await askReferenceForGeneration(ctx);
  });

  bot.callbackQuery(/^hook:([^:]+):(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    const hookId = ctx.match[2];
    await selectProjectHook(prisma, projectId, hookId);
    ctx.session.projectId = projectId;
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await askReferenceForGeneration(ctx);
  });

  bot.callbackQuery(/^referenceface:use:(.+)$/, async (ctx) => {
    const imageUrl = await useSavedReferenceFace(ctx, ctx.match[1], token);
    if (!imageUrl) return;
    await deleteCallbackMessage(ctx);
    await enqueueGenerationFromReference(ctx, imageUrl);
  });

  bot.callbackQuery("referenceface:upload", async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    ctx.session.step = "referenceUpload";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(referenceForGenerationPrompt());
  });

  bot.on("message:video", async (ctx) => {
    if (ctx.session.step !== "sourceVideo") {
      await ctx.reply("Видео получил. Чтобы использовать его для обложки, нажмите «Создать обложку» → «Загрузить видео».", {
        reply_markup: mainKeyboard()
      });
      return;
    }
    const file = await ctx.api.getFile(ctx.message.video.file_id);
    await createProjectFromSource(ctx, "VIDEO", {
      fileId: ctx.message.video.file_id,
      mimeType: ctx.message.video.mime_type,
      url: file.file_path ? telegramFileUrl(token, file.file_path) : undefined,
      metadata: { duration: ctx.message.video.duration, fileSize: ctx.message.video.file_size }
    });
  });
}

export async function handleProjectText(ctx: BotContext) {
  if (ctx.session.step === "sourceLink") {
    const url = ctx.message?.text?.trim() ?? "";
    if (!url.startsWith("http")) {
      await ctx.reply("Похоже, это не ссылка. Отправьте URL, который начинается с http или https.");
      return true;
    }
    await createProjectFromSource(ctx, "LINK", { url });
    return true;
  }

  if (ctx.session.step === "sourceTranscript") {
    const text = ctx.message?.text?.trim() ?? "";
    if (text.length < 80) {
      await ctx.reply("Текст слишком короткий. Вставьте хотя бы несколько абзацев, чтобы я понял смысл ролика.");
      return true;
    }
    await createProjectFromSource(ctx, "TRANSCRIPT", { text });
    return true;
  }

  return false;
}

export async function handleProjectPhoto(ctx: BotContext, token: string) {
  if (await saveUploadedGuestFace(ctx, token)) {
    await hookQueue.add("generate-hooks", { projectId: ctx.session.projectId!, userTelegramId: ctx.from!.id }, { jobId: hookJobId(ctx.session.projectId!) });
    await ctx.reply("Сохранил второе лицо. Анализирую ролик и готовлю варианты текста для обложки.");
    return true;
  }

  if (!ctx.session.projectId || ctx.session.step !== "referenceUpload") {
    return false;
  }

  const photo = ctx.message?.photo?.at(-1);
  if (!photo) {
    return false;
  }

  const file = await ctx.api.getFile(photo.file_id);
  if (!file.file_path) {
    await ctx.reply("Не получилось прочитать фото. Попробуйте отправить изображение ещё раз.");
    return true;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const imageUrl = telegramFileUrl(token, file.file_path);
  await saveUploadedReferenceFace(ctx, { token, photo, filePath: file.file_path });
  await createAndEnqueueGeneration(ctx, user.id, imageUrl);
  await ctx.reply("Принял визуальную основу. Собираю обложку в выбранном стиле.");
  return true;
}

async function enqueueGenerationFromReference(ctx: BotContext, referenceImageUrl: string) {
  if (!ctx.session.projectId) return;
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  await createAndEnqueueGeneration(ctx, user.id, referenceImageUrl);
  await ctx.reply("Взял сохранённое лицо. Собираю обложку в выбранном стиле.");
}

async function createAndEnqueueGeneration(ctx: BotContext, userId: string, referenceImageUrl: string) {
  if (!ctx.session.projectId) return;
  const chargeCredits = process.env.FREE_GENERATION_MODE === "false";
  const generation = await createGenerationFromProject(prisma, {
    projectId: ctx.session.projectId,
    userId,
    referenceImageUrl,
    chargeCredits
  });
  await generationQueue.add("generate-cover", { generationId: generation.id, userTelegramId: ctx.from!.id }, { jobId: generationJobId(generation.id) });
  resetWizard(ctx);
}

async function createProjectFromSource(
  ctx: BotContext,
  sourceType: SourceType,
  source: { url?: string; text?: string; fileId?: string; mimeType?: string; metadata?: object }
) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const project = await createProject(prisma, { userId: user.id, sourceType, source });
  ctx.session.projectId = project.id;
  ctx.session.step = "idle";
  await ctx.reply(platformPrompt(), { reply_markup: platformKeyboard() });
}

function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
