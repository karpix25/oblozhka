import { findProject, getBillingAccess, listTemplates, prisma, upsertTelegramUser } from "@covers/db";
import { InlineKeyboard } from "grammy";
import type { BotAbuseGuard } from "../abuseGuard.js";
import { styleSourceKeyboard } from "../keyboards.js";
import { platformPrompt, sourcePrompt } from "../messages.js";
import { deleteCallbackMessage } from "../navigation.js";
import { askGuestFace, requiresGuestFace } from "../guestFaceFlow.js";
import { askReferenceForGeneration } from "../referenceFaceFlow.js";
import { hookJobId, hookQueue } from "../queue.js";
import { backHomeKeyboard, projectsKeyboard } from "../sectionKeyboards.js";
import type { BotContext } from "../session.js";
import { sendTemplateRecommendations } from "./templateRecommendations.js";
import { profileFromContext } from "../userProfile.js";
import { platformKeyboard, sourceTypeKeyboard } from "../keyboards.js";
import { trackProductEvent } from "./analytics.js";
import { prepareHookJob } from "./hookRetry.js";

export async function enqueueProjectHooks(ctx: BotContext, abuseGuard: BotAbuseGuard, retry = false) {
  const projectId = ctx.session.projectId;
  if (!projectId || !(await abuseGuard.consume(ctx, "hook-generation"))) return false;

  try {
    await prepareHookJob(hookQueue, hookJobId(projectId));
  } catch (error) {
    console.error("Hook retry preparation failed", { projectId, error });
    await ctx.reply("Не удалось перезапустить анализ прямо сейчас. Проект сохранён — попробуйте ещё раз через минуту.", {
      reply_markup: projectsKeyboard()
    });
    return false;
  }
  await hookQueue.add(
    "generate-hooks",
    { projectId, userTelegramId: ctx.from!.id },
    { jobId: hookJobId(projectId) }
  );
  trackProductEvent("hooks_started", { projectId, metadata: { retry } });
  await ctx.reply(retry ? "Пробую подготовить текст ещё раз." : "Анализирую ролик и готовлю варианты текста для обложки.");
  return true;
}

export async function resumeProject(ctx: BotContext, projectId: string, abuseGuard: BotAbuseGuard) {
  const project = await findOwnedProject(ctx, projectId);
  if (!project) return;
  ctx.session.projectId = project.id;
  ctx.session.sourceType = project.sourceType;
  ctx.session.step = "idle";
  trackProductEvent("project_resumed", { projectId: project.id, userId: project.userId });

  if (!project.platform) {
    await ctx.reply(platformPrompt(), { reply_markup: platformKeyboard() });
    return;
  }
  if (!project.selectedTemplate && !project.selectedUserStyleAsset) {
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const access = await getBillingAccess(prisma, user.id);
    await ctx.reply("Выберите источник стиля:", { reply_markup: styleSourceKeyboard(access) });
    return;
  }
  if (requiresGuestFace(project.selectedTemplate) && !project.guestFaceAsset) {
    await askGuestFace(ctx);
    return;
  }
  if (project.hooks.length === 0 || project.status === "SOURCE_FAILED") {
    await enqueueProjectHooks(ctx, abuseGuard, project.status === "SOURCE_FAILED");
    return;
  }
  if (!project.selectedHook) {
    await sendHookChoices(ctx, project.id, project.hooks);
    return;
  }
  if (project.status === "GENERATION_PENDING") {
    await ctx.reply("Обложка уже в работе. Пришлю результат сюда, когда она будет готова.", {
      reply_markup: projectsKeyboard()
    });
    return;
  }
  if (project.status === "COMPLETED") {
    await ctx.reply("Этот проект уже готов. Результат находится в разделе «Мои обложки».", {
      reply_markup: projectsKeyboard()
    });
    return;
  }
  await askReferenceForGeneration(ctx);
}

export async function showProjectHooks(ctx: BotContext) {
  if (!ctx.session.projectId) return;
  const project = await findOwnedProject(ctx, ctx.session.projectId);
  if (!project) return;
  if (project.hooks.length === 0) {
    await ctx.reply("Варианты текста ещё готовятся. Я пришлю их отдельным сообщением.", {
      reply_markup: projectsKeyboard()
    });
    return;
  }
  await sendHookChoices(ctx, project.id, project.hooks);
}

export async function showProjectTemplates(ctx: BotContext) {
  if (!ctx.session.projectId) return;
  const project = await findOwnedProject(ctx, ctx.session.projectId);
  if (!project?.platform) return;
  const templates = await listTemplates(prisma, project.platform);
  await sendTemplateRecommendations(ctx, templates, project.platform, {
    topicText: project.topicSummary ?? project.transcripts[0]?.cleanText ?? project.transcripts[0]?.rawText,
    guestFaceAvailable: Boolean(project.guestFaceAsset)
  });
}

export async function showProjectSourcePrompt(ctx: BotContext) {
  const sourceType = ctx.session.sourceType;
  if (!sourceType) {
    await ctx.reply("С чего начнём?", { reply_markup: sourceTypeKeyboard() });
    return;
  }
  ctx.session.step = sourceType === "LINK" ? "sourceLink" : sourceType === "VIDEO" ? "sourceVideo" : "sourceTranscript";
  await ctx.reply(sourcePrompt(sourceType), { reply_markup: backHomeKeyboard("project:back:sources") });
}

export async function findOwnedProject(ctx: BotContext, projectId: string) {
  const project = await findProject(prisma, projectId);
  if (!project || String(project.user.telegramId) !== String(ctx.from?.id)) {
    await ctx.reply("Проект не найден или недоступен.", { reply_markup: projectsKeyboard() });
    return null;
  }
  return project;
}

async function sendHookChoices(
  ctx: BotContext,
  projectId: string,
  hooks: Array<{ id: string; text: string }>
) {
  const keyboard = new InlineKeyboard().text("⭐ Использовать лучший вариант", `hook:auto:${projectId}`).row();
  hooks.slice(0, 4).forEach((hook, index) => {
    keyboard.text(`${index + 1}. ${hook.text}`, `hook:${projectId}:${hook.id}`).row();
  });
  keyboard.text("⬅️ Назад", "project:back:templates").text("🏠 В начало", "home");
  await ctx.reply("Рекомендую первый вариант. Можно использовать его сразу или выбрать другой:", {
    reply_markup: keyboard
  });
}
