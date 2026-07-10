import { createProject, prisma, upsertTelegramUser } from "@covers/db";
import type { SourceType } from "@covers/domain";
import type { BotAbuseGuard } from "../abuseGuard.js";
import { platformKeyboard } from "../keyboards.js";
import { platformPrompt } from "../messages.js";
import { backHomeKeyboard, projectsKeyboard } from "../sectionKeyboards.js";
import type { BotContext } from "../session.js";
import { profileFromContext } from "../userProfile.js";
import { trackProductEvent } from "./analytics.js";

const DEFAULT_VIDEO_LIMIT_BYTES = 20 * 1024 * 1024;

export async function handleProjectTextSource(ctx: BotContext, abuseGuard: BotAbuseGuard) {
  if (ctx.session.step === "sourceLink") {
    const url = ctx.message?.text?.trim() ?? "";
    if (!/^https?:\/\//i.test(url)) {
      await ctx.reply("Похоже, это не ссылка. Отправьте URL, который начинается с http или https.", {
        reply_markup: backHomeKeyboard("project:back:sources")
      });
      return true;
    }
    if (!(await abuseGuard.consume(ctx, "source-submit"))) return true;
    await createProjectFromSource(ctx, "LINK", { url });
    return true;
  }

  if (ctx.session.step === "sourceTranscript") {
    const text = ctx.message?.text?.trim() ?? "";
    if (text.length < 80) {
      await ctx.reply("Текст слишком короткий. Вставьте хотя бы несколько абзацев, чтобы я понял смысл ролика.", {
        reply_markup: backHomeKeyboard("project:back:sources")
      });
      return true;
    }
    if (!(await abuseGuard.consume(ctx, "source-submit"))) return true;
    await createProjectFromSource(ctx, "TRANSCRIPT", { text });
    return true;
  }

  return false;
}

export async function handleProjectVideoSource(
  ctx: BotContext,
  token: string,
  abuseGuard: BotAbuseGuard,
  video: { fileId: string; mimeType?: string; duration?: number; fileSize?: number }
) {
  if (ctx.session.step !== "sourceVideo") {
    await ctx.reply("Видео получил. Чтобы использовать его для обложки, нажмите «Создать обложку» → «Загрузить видео».", {
      reply_markup: projectsKeyboard()
    });
    return;
  }
  const maxBytes = Number(process.env.SOURCE_VIDEO_MAX_BYTES) || DEFAULT_VIDEO_LIMIT_BYTES;
  if (video.fileSize && video.fileSize > maxBytes) {
    const maxMb = Math.floor(maxBytes / 1024 / 1024);
    await ctx.reply(`Видео слишком большое. Максимальный размер — ${maxMb} МБ. Сожмите файл или отправьте ссылку на ролик.`, {
      reply_markup: backHomeKeyboard("project:back:sources")
    });
    return;
  }
  if (!(await abuseGuard.consume(ctx, "source-submit"))) return;

  const file = await ctx.api.getFile(video.fileId);
  if (!file.file_path) {
    await ctx.reply("Не получилось прочитать видео. Отправьте файл ещё раз.", {
      reply_markup: backHomeKeyboard("project:back:sources")
    });
    return;
  }
  await createProjectFromSource(ctx, "VIDEO", {
    fileId: video.fileId,
    mimeType: video.mimeType,
    url: telegramFileUrl(token, file.file_path),
    metadata: { duration: video.duration, fileSize: video.fileSize }
  });
}

export async function handleProjectVideoDocument(
  ctx: BotContext,
  token: string,
  abuseGuard: BotAbuseGuard
) {
  const document = ctx.message?.document;
  if (!document) return;
  if (!document.mime_type?.startsWith("video/")) {
    if (ctx.session.step === "sourceVideo") {
      await ctx.reply("Нужен видеофайл. Отправьте MP4, MOV или другое видео, а не документ этого типа.", {
        reply_markup: backHomeKeyboard("project:back:sources")
      });
    }
    return;
  }
  await handleProjectVideoSource(ctx, token, abuseGuard, {
    fileId: document.file_id,
    mimeType: document.mime_type,
    fileSize: document.file_size
  });
}

export async function createProjectFromSource(
  ctx: BotContext,
  sourceType: SourceType,
  source: { url?: string; text?: string; fileId?: string; mimeType?: string; metadata?: object }
) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const project = await createProject(prisma, { userId: user.id, sourceType, source });
  trackProductEvent("project_started", { userId: user.id, projectId: project.id });
  trackProductEvent("source_submitted", { userId: user.id, projectId: project.id, metadata: { sourceType } });
  ctx.session.projectId = project.id;
  ctx.session.sourceType = sourceType;
  ctx.session.step = "idle";
  await ctx.reply(platformPrompt(), { reply_markup: platformKeyboard() });
}

export function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
