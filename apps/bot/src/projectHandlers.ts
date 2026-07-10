import {
  findProject,
  getBillingAccess,
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
import { askGuestFace, requiresGuestFace, useSavedGuestFace } from "./guestFaceFlow.js";
import {
  platformPrompt,
  referenceForGenerationPrompt,
  sourcePrompt,
  sourceStartMessage,
} from "./messages.js";
import { deleteCallbackMessage } from "./navigation.js";
import { sendProjectList } from "./projectList.js";
import { askReferenceForGeneration, useSavedReferenceFace } from "./referenceFaceFlow.js";
import { backHomeKeyboard, projectsKeyboard } from "./sectionKeyboards.js";
import { type BotContext, resetWizard } from "./session.js";
import { sendFaceGallery, type FaceGalleryMode } from "./faceGallery.js";
import { openStyleLibrary, selectUserStyleForProject, startStyleUpload } from "./styleLibrary.js";
import { sendTemplateGallery } from "./templateGallery.js";
import { profileFromContext } from "./userProfile.js";
import {
  handleProjectTextSource,
  handleProjectVideoDocument,
  handleProjectVideoSource,
} from "./projectFlow/sourceFlow.js";
import { enqueueProjectHooks, findOwnedProject } from "./projectFlow/hookFlow.js";
import { trackProductEvent } from "./projectFlow/analytics.js";
import { enqueueGenerationFromReference } from "./projectFlow/referenceGenerationFlow.js";
import { registerProjectNavigationHandlers } from "./projectFlow/navigationHandlers.js";
import { openCoverHistory } from "./projectFlow/historyFlow.js";

export { handleProjectPhoto } from "./projectFlow/referenceGenerationFlow.js";
export { openCoverHistory } from "./projectFlow/historyFlow.js";

export function registerProjectHandlers(bot: Bot<BotContext>, token: string, abuseGuard: BotAbuseGuard) {
  registerProjectNavigationHandlers(bot, abuseGuard);
  bot.callbackQuery("project:start", async (ctx) => {
    resetWizard(ctx);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
  });

  bot.callbackQuery("projects:mine", async (ctx) => {
    await sendProjectList(ctx, { fromCallback: true });
  });

  bot.callbackQuery("covers:mine", async (ctx) => {
    await openCoverHistory(ctx, { fromCallback: true });
  });

  bot.callbackQuery(/^covers:browse:(-?\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await openCoverHistory(ctx, { page: Number(ctx.match[1]), replace: true });
  });

  bot.callbackQuery("covers:noop", async (ctx) => {
    await ctx.answerCallbackQuery();
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

  bot.callbackQuery(/^templates:all:(YOUTUBE|INSTAGRAM_TIKTOK|FACELESS)$/, async (ctx) => {
    const platform = ctx.match[1] as ProjectPlatform;
    const templates = await listTemplates(prisma, platform);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    ctx.session.templateGalleryMode = "select";
    await sendTemplateGallery(ctx, templates, { mode: "select", platform });
  });

  bot.callbackQuery(/^project:change-template:(.+)$/, async (ctx) => {
    const project = await findOwnedProject(ctx, ctx.match[1]);
    if (!project?.platform) {
      await ctx.answerCallbackQuery("Сначала выберите формат.");
      return;
    }
    const templates = await listTemplates(prisma, project.platform);
    ctx.session.projectId = project.id;
    ctx.session.templateGalleryMode = "select";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await sendTemplateGallery(ctx, templates, { mode: "select", platform: project.platform });
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
    ctx.session.sourceType = sourceType;
    trackProductEvent("source_type_selected", { metadata: { sourceType, telegramId: ctx.from.id } });
    ctx.session.step = sourceType === "LINK" ? "sourceLink" : sourceType === "VIDEO" ? "sourceVideo" : "sourceTranscript";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourcePrompt(sourceType), { reply_markup: backHomeKeyboard("project:back:sources") });
  });

  bot.callbackQuery(/^platform:(YOUTUBE|INSTAGRAM_TIKTOK|FACELESS)$/, async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    const platform = ctx.match[1] as ProjectPlatform;
    await setProjectPlatform(prisma, ctx.session.projectId, platform);
    trackProductEvent("platform_selected", { projectId: ctx.session.projectId, metadata: { platform } });
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const access = await getBillingAccess(prisma, user.id);
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Выберите источник стиля:", { reply_markup: styleSourceKeyboard(access) });
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
    trackProductEvent("template_selected", {
      projectId: project.id,
      metadata: { templateId: project.selectedTemplate?.id, templateSlug: project.selectedTemplate?.slug }
    });
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
    await ctx.reply("Загрузите фото второго человека для podcast countdown.", { reply_markup: backHomeKeyboard("project:back:templates") });
  });

  async function enqueueHooks(ctx: BotContext) {
    await enqueueProjectHooks(ctx, abuseGuard);
  }

  bot.callbackQuery(/^hook:auto:(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    if (!(await findOwnedProject(ctx, projectId))) {
      await ctx.answerCallbackQuery("Проект недоступен.");
      return;
    }
    await selectBestProjectHook(prisma, projectId);
    trackProductEvent("hook_selected", { projectId, metadata: { mode: "best" } });
    ctx.session.projectId = projectId;
    await ctx.answerCallbackQuery("Выбрал лучший вариант.");
    await deleteCallbackMessage(ctx);
    await askReferenceForGeneration(ctx);
  });

  bot.callbackQuery(/^hook:([^:]+):(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    const hookId = ctx.match[2];
    const project = await findOwnedProject(ctx, projectId);
    if (!project || !project.hooks.some((hook) => hook.id === hookId)) {
      await ctx.answerCallbackQuery("Вариант текста недоступен.");
      return;
    }
    await selectProjectHook(prisma, projectId, hookId);
    trackProductEvent("hook_selected", { projectId, metadata: { mode: "manual", hookId } });
    ctx.session.projectId = projectId;
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await askReferenceForGeneration(ctx);
  });

  bot.callbackQuery(/^referenceface:choose:(.+)$/, async (ctx) => {
    const project = await findOwnedProject(ctx, ctx.match[1]);
    if (!project) {
      await ctx.answerCallbackQuery("Проект недоступен.");
      return;
    }
    ctx.session.projectId = project.id;
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await askReferenceForGeneration(ctx);
  });

  bot.callbackQuery(/^referenceface:use:(.+)$/, async (ctx) => {
    const imageUrl = await useSavedReferenceFace(ctx, ctx.match[1], token);
    if (!imageUrl) return;
    trackProductEvent("reference_selected", { projectId: ctx.session.projectId, metadata: { source: "saved" } });
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
    await ctx.reply(referenceForGenerationPrompt(), { reply_markup: backHomeKeyboard("project:back:templates") });
  });

  bot.on("message:video", async (ctx) => {
    await handleProjectVideoSource(ctx, token, abuseGuard, {
      fileId: ctx.message.video.file_id,
      mimeType: ctx.message.video.mime_type,
      duration: ctx.message.video.duration,
      fileSize: ctx.message.video.file_size
    });
  });

  bot.on("message:document", async (ctx) => {
    await handleProjectVideoDocument(ctx, token, abuseGuard);
  });
}

export async function handleProjectText(ctx: BotContext, abuseGuard: BotAbuseGuard) {
  return handleProjectTextSource(ctx, abuseGuard);
}
