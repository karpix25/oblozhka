import {
  createGenerationFromProject,
  createProject,
  listTemplates,
  listUserProjects,
  prisma,
  selectProjectHook,
  setProjectPlatform,
  setProjectTemplate,
  upsertTelegramUser
} from "@covers/db";
import type { ProjectPlatform, SourceType } from "@covers/domain";
import type { Bot } from "grammy";
import { mainKeyboard, platformKeyboard, sourceTypeKeyboard, templatesKeyboard } from "./keyboards.js";
import {
  platformPrompt,
  referenceForGenerationPrompt,
  sourcePrompt,
  sourceStartMessage,
  templatePrompt
} from "./messages.js";
import { generationQueue, hookQueue } from "./queue.js";
import { type BotContext, resetWizard } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export function registerProjectHandlers(bot: Bot<BotContext>, token: string) {
  bot.callbackQuery("project:start", async (ctx) => {
    resetWizard(ctx);
    await ctx.answerCallbackQuery();
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
  });

  bot.callbackQuery("projects:mine", async (ctx) => {
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const projects = await listUserProjects(prisma, user.id);
    await ctx.answerCallbackQuery();
    if (projects.length === 0) {
      await ctx.reply("Пока нет проектов. Начните с кнопки «Новый проект».", { reply_markup: mainKeyboard() });
      return;
    }
    await ctx.reply(
      projects
        .map((project, index) => `${index + 1}. ${project.platform ?? "без платформы"} · ${project.status} · ${project.selectedHook?.text ?? "хуки не выбраны"}`)
        .join("\n")
    );
  });

  bot.callbackQuery("templates:library", async (ctx) => {
    const templates = await listTemplates(prisma);
    await ctx.answerCallbackQuery();
    await ctx.reply(["Библиотека шаблонов:", "", ...templates.map((template) => `• ${template.title} — ${template.platform}`)].join("\n"));
  });

  bot.callbackQuery(/^source:(LINK|VIDEO|TRANSCRIPT)$/, async (ctx) => {
    const sourceType = ctx.match[1] as SourceType;
    ctx.session.step = sourceType === "LINK" ? "sourceLink" : sourceType === "VIDEO" ? "sourceVideo" : "sourceTranscript";
    await ctx.answerCallbackQuery();
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
    await ctx.reply(templatePrompt(), { reply_markup: templatesKeyboard(templates) });
  });

  bot.callbackQuery(/^template:(.+)$/, async (ctx) => {
    if (!ctx.session.projectId) {
      await ctx.answerCallbackQuery("Сначала создайте проект.");
      return;
    }
    await setProjectTemplate(prisma, ctx.session.projectId, ctx.match[1]);
    await hookQueue.add("generate-hooks", { projectId: ctx.session.projectId, userTelegramId: ctx.from.id }, { jobId: `${ctx.session.projectId}:hooks` });
    await ctx.answerCallbackQuery();
    await ctx.reply("Анализирую ролик и готовлю 5 сильных хуков для CTR. Пришлю варианты отдельным сообщением.");
  });

  bot.callbackQuery(/^hook:([^:]+):(.+)$/, async (ctx) => {
    const projectId = ctx.match[1];
    const hookId = ctx.match[2];
    await selectProjectHook(prisma, projectId, hookId);
    ctx.session.projectId = projectId;
    ctx.session.step = "referenceUpload";
    await ctx.answerCallbackQuery();
    await ctx.reply(referenceForGenerationPrompt());
  });

  bot.on("message:video", async (ctx) => {
    if (ctx.session.step !== "sourceVideo") {
      await ctx.reply("Видео получил. Чтобы сделать из него проект, нажмите «Новый проект» → «Загрузить видео».", {
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
      await ctx.reply("Транскрипт слишком короткий. Вставьте хотя бы несколько абзацев, чтобы AI нашёл сильный хук.");
      return true;
    }
    await createProjectFromSource(ctx, "TRANSCRIPT", { text });
    return true;
  }

  return false;
}

export async function handleProjectPhoto(ctx: BotContext, token: string) {
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
  const chargeCredits = process.env.FREE_GENERATION_MODE === "false";
  const generation = await createGenerationFromProject(prisma, {
    projectId: ctx.session.projectId,
    userId: user.id,
    referenceImageUrl: telegramFileUrl(token, file.file_path),
    chargeCredits
  });
  await generationQueue.add("generate-cover", { generationId: generation.id, userTelegramId: ctx.from!.id }, { jobId: generation.id });
  resetWizard(ctx);
  await ctx.reply("Принял визуальную основу. Генерирую обложку по выбранному хуку и шаблону.");
  return true;
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
