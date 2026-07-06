import {
  createProject,
  findProject,
  listUserFaceAssets,
  listTemplates,
  prisma,
  selectBestProjectHook,
  selectProjectHook,
  setProjectPlatform,
  setProjectTemplate,
  upsertTelegramUser
} from "@covers/db";
import type { ProjectPlatform, SourceType } from "@covers/domain";
import type { Bot } from "grammy";
import type { BotAbuseGuard } from "./abuseGuard.js";
import { openFaceLibrary } from "./faceLibrary.js";
import { platformKeyboard, sourceTypeKeyboard, styleSourceKeyboard } from "./keyboards.js";
import { askGuestFace, requiresGuestFace, saveUploadedGuestFace, useSavedGuestFace } from "./guestFaceFlow.js";
import {
  platformPrompt,
  referenceForGenerationPrompt,
  sourcePrompt,
  sourceStartMessage,
} from "./messages.js";
import { deleteCallbackMessage } from "./navigation.js";
import { createAndEnqueueProjectGeneration } from "./projectGenerationFlow.js";
import { sendProjectList } from "./projectList.js";
import { hookJobId, hookQueue } from "./queue.js";
import { askReferenceForGeneration, saveUploadedReferenceFace, useSavedReferenceFace } from "./referenceFaceFlow.js";
import { backHomeKeyboard, projectsKeyboard } from "./sectionKeyboards.js";
import { type BotContext, resetWizard } from "./session.js";
import { sendFaceGallery, type FaceGalleryMode } from "./faceGallery.js";
import { openStyleLibrary, saveUploadedStyle, selectUserStyleForProject, startStyleUpload } from "./styleLibrary.js";
import { sendTemplateGallery } from "./templateGallery.js";
import { profileFromContext } from "./userProfile.js";

export function registerProjectHandlers(bot: Bot<BotContext>, token: string, abuseGuard: BotAbuseGuard) {
  bot.callbackQuery("project:start", async (ctx) => {
    resetWizard(ctx);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
  });

  bot.callbackQuery("projects:mine", async (ctx) => {
    await sendProjectList(ctx, { fromCallback: true });
  });

  bot.callbackQuery("faces:mine", async (ctx) => {
    await openFaceLibrary(ctx, { fromCallback: true });
  });

  bot.callbackQuery("styles:mine", async (ctx) => {
    await openStyleLibrary(ctx, { fromCallback: true });
  });

  bot.callbackQuery("styles:upload", async (ctx) => {
    await startStyleUpload(ctx);
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

  bot.callbackQuery(/^faces:browse:(browse|reference|guest):(-?\d+)$/, async (ctx) => {
    const mode = ctx.match[1] as FaceGalleryMode;
    const page = Number(ctx.match[2]);
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const faces = await listUserFaceAssets(prisma, user.id, mode === "browse" ? 10 : 6);
    await ctx.answerCallbackQuery();
    await sendFaceGallery(ctx, faces, { mode, page, replace: true });
  });

  bot.callbackQuery("faces:noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^source:(LINK|VIDEO|TRANSCRIPT)$/, async (ctx) => {
    const sourceType = ctx.match[1] as SourceType;
    ctx.session.step = sourceType === "LINK" ? "sourceLink" : sourceType === "VIDEO" ? "sourceVideo" : "sourceTranscript";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourcePrompt(sourceType), { reply_markup: backHomeKeyboard() });
  });

  bot.callbackQuery(/^platform:(YOUTUBE|INSTAGRAM_TIKTOK|FACELESS)$/, async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    const platform = ctx.match[1] as ProjectPlatform;
    await setProjectPlatform(prisma, ctx.session.projectId, platform);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Выберите источник стиля:", { reply_markup: styleSourceKeyboard() });
  });

  bot.callbackQuery("style-source:library", async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    const project = await findProject(prisma, ctx.session.projectId);
    const platform = project?.platform ?? "YOUTUBE";
    const templates = await listTemplates(prisma, platform);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    ctx.session.templateGalleryMode = "select";
    await sendTemplateGallery(ctx, templates, { mode: "select", platform });
  });

  bot.callbackQuery("style-source:custom", async (ctx) => {
    await openStyleLibrary(ctx, { fromCallback: true, selectForProject: true });
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

  bot.callbackQuery(/^style:use:(.+)$/, async (ctx) => {
    if (await selectUserStyleForProject(ctx, ctx.match[1])) {
      await deleteCallbackMessage(ctx);
      await enqueueHooks(ctx);
    }
  });

  bot.callbackQuery(/^guestface:use:(.+)$/, async (ctx) => {
    if (await useSavedGuestFace(ctx, ctx.match[1], token)) {
      await deleteCallbackMessage(ctx);
      await enqueueHooks(ctx);
    }
  });

  bot.callbackQuery("guestface:upload", async (ctx) => {
    ctx.session.step = "guestFaceUpload";
    ctx.session.faceGalleryMode = "guest";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Загрузите фото второго человека для podcast countdown.", { reply_markup: backHomeKeyboard() });
  });

  async function enqueueHooks(ctx: BotContext) {
    if (!ctx.session.projectId) return;
    if (!(await abuseGuard.consume(ctx, "hook-generation"))) return;
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
    await enqueueGenerationFromReference(ctx, imageUrl, abuseGuard);
  });

  bot.callbackQuery("referenceface:upload", async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    ctx.session.step = "referenceUpload";
    ctx.session.faceGalleryMode = "reference";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(referenceForGenerationPrompt(), { reply_markup: backHomeKeyboard() });
  });

  bot.on("message:video", async (ctx) => {
    if (ctx.session.step !== "sourceVideo") {
      await ctx.reply("Видео получил. Чтобы использовать его для обложки, нажмите «Создать обложку» → «Загрузить видео».", {
        reply_markup: projectsKeyboard()
      });
      return;
    }
    if (!(await abuseGuard.consume(ctx, "source-submit"))) {
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

export async function handleProjectText(ctx: BotContext, abuseGuard: BotAbuseGuard) {
  if (ctx.session.step === "sourceLink") {
    const url = ctx.message?.text?.trim() ?? "";
    if (!url.startsWith("http")) {
      await ctx.reply("Похоже, это не ссылка. Отправьте URL, который начинается с http или https.", {
        reply_markup: backHomeKeyboard()
      });
      return true;
    }
    if (!(await abuseGuard.consume(ctx, "source-submit"))) {
      return true;
    }
    await createProjectFromSource(ctx, "LINK", { url });
    return true;
  }

  if (ctx.session.step === "sourceTranscript") {
    const text = ctx.message?.text?.trim() ?? "";
    if (text.length < 80) {
      await ctx.reply("Текст слишком короткий. Вставьте хотя бы несколько абзацев, чтобы я понял смысл ролика.", {
        reply_markup: backHomeKeyboard()
      });
      return true;
    }
    if (!(await abuseGuard.consume(ctx, "source-submit"))) {
      return true;
    }
    await createProjectFromSource(ctx, "TRANSCRIPT", { text });
    return true;
  }

  return false;
}

export async function handleProjectPhoto(ctx: BotContext, token: string, abuseGuard: BotAbuseGuard) {
  if (ownsProjectPhotoFlow(ctx) && !(await abuseGuard.consume(ctx, "asset-upload"))) {
    return true;
  }

  if (await saveUploadedStyle(ctx, token)) {
    return true;
  }

  const guestFaceResult = await saveUploadedGuestFace(ctx, token);
  if (guestFaceResult === "saved") {
    if (!(await abuseGuard.consume(ctx, "hook-generation"))) return true;
    await hookQueue.add("generate-hooks", { projectId: ctx.session.projectId!, userTelegramId: ctx.from!.id }, { jobId: hookJobId(ctx.session.projectId!) });
    await ctx.reply("Сохранил второе лицо. Анализирую ролик и готовлю варианты текста для обложки.");
    return true;
  }
  if (guestFaceResult === "handled") {
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
    await ctx.reply("Не получилось прочитать фото. Попробуйте отправить изображение ещё раз.", {
      reply_markup: backHomeKeyboard()
    });
    return true;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const imageUrl = telegramFileUrl(token, file.file_path);
  await ctx.reply("Принял фото. Сохраняю лицо, а улучшенную карту лица подготовлю в фоне.");
  const face = await saveUploadedReferenceFace(ctx, { token, photo, filePath: file.file_path });
  if (face === false) {
    return true;
  }
  if (await createAndEnqueueProjectGeneration(ctx, { userId: user.id, referenceImageUrl: face?.imageUrl ?? imageUrl })) {
    resetWizard(ctx);
    await ctx.reply("Аватар сохранён. Собираю обложку в выбранном стиле.");
  }
  return true;
}

async function enqueueGenerationFromReference(
  ctx: BotContext,
  referenceImageUrl: string,
  abuseGuard: BotAbuseGuard
) {
  if (!ctx.session.projectId) return;
  if (!(await abuseGuard.consume(ctx, "cover-generation"))) return;
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  if (await createAndEnqueueProjectGeneration(ctx, { userId: user.id, referenceImageUrl })) {
    resetWizard(ctx);
    await ctx.reply("Взял сохранённое лицо. Собираю обложку в выбранном стиле.");
  }
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

function ownsProjectPhotoFlow(ctx: BotContext) {
  return (
    ctx.session.step === "styleUpload" ||
    ctx.session.step === "guestFaceUpload" ||
    Boolean(ctx.session.projectId && ctx.session.step === "referenceUpload")
  );
}
