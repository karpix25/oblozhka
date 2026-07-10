import { findProject, getBillingAccess, prisma, upsertTelegramUser } from "@covers/db";
import type { Bot } from "grammy";
import type { BotAbuseGuard } from "../abuseGuard.js";
import { platformKeyboard, sourceTypeKeyboard, styleSourceKeyboard } from "../keyboards.js";
import { platformPrompt, sourceStartMessage } from "../messages.js";
import { deleteCallbackMessage } from "../navigation.js";
import { projectsKeyboard } from "../sectionKeyboards.js";
import type { BotContext } from "../session.js";
import {
  enqueueProjectHooks,
  resumeProject,
  showProjectHooks,
  showProjectSourcePrompt,
  showProjectTemplates
} from "./hookFlow.js";
import { profileFromContext } from "../userProfile.js";

export function registerProjectNavigationHandlers(bot: Bot<BotContext>, abuseGuard: BotAbuseGuard) {
  bot.callbackQuery(/^project:resume:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await resumeProject(ctx, ctx.match[1], abuseGuard);
  });

  bot.callbackQuery(/^project:retry-hooks:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    const project = await findProject(prisma, ctx.match[1]);
    if (!project || String(project.user.telegramId) !== String(ctx.from.id)) {
      await ctx.reply("Проект не найден или недоступен.", { reply_markup: projectsKeyboard() });
      return;
    }
    ctx.session.projectId = project.id;
    await enqueueProjectHooks(ctx, abuseGuard, true);
  });

  registerBackHandlers(bot);
}

function registerBackHandlers(bot: Bot<BotContext>) {
  bot.callbackQuery("project:back:sources", async (ctx) => {
    ctx.session.step = "idle";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(sourceStartMessage(), { reply_markup: sourceTypeKeyboard() });
  });
  bot.callbackQuery("project:back:source", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await showProjectSourcePrompt(ctx);
  });
  bot.callbackQuery("project:back:platform", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply(platformPrompt(), { reply_markup: platformKeyboard() });
  });
  bot.callbackQuery("project:back:templates", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await showProjectTemplates(ctx);
  });
  bot.callbackQuery("project:back:style-source", async (ctx) => {
    const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
    const access = await getBillingAccess(prisma, user.id);
    ctx.session.step = "idle";
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await ctx.reply("Выберите источник стиля:", { reply_markup: styleSourceKeyboard(access) });
  });
  bot.callbackQuery("project:back:hooks", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
    await showProjectHooks(ctx);
  });
}
