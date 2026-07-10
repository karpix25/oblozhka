import { listUserProjects, prisma, upsertTelegramUser } from "@covers/db";
import { InlineKeyboard } from "grammy";
import { deleteCallbackMessage } from "./navigation.js";
import { platformLabel, projectStatusLabel } from "./projectLabels.js";
import { projectsKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export async function sendProjectList(ctx: BotContext, input: { fromCallback?: boolean } = {}) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const projects = await listUserProjects(prisma, user.id);

  if (input.fromCallback) {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
  }

  if (projects.length === 0) {
    await ctx.reply("Пока нет проектов. Начните с кнопки «Создать обложку».", { reply_markup: projectsKeyboard() });
    return;
  }

  const visibleProjects = projects.slice(0, 8);
  const keyboard = new InlineKeyboard();
  visibleProjects.forEach((project, index) => {
    keyboard.text(`${index + 1}. ${projectActionLabel(project.status)}`, `project:resume:${project.id}`).row();
  });
  keyboard.text("🎨 Новый проект", "project:start").row().text("🏠 В начало", "home");

  await ctx.reply(
    visibleProjects
      .map((project, index) => `${index + 1}. ${platformLabel(project.platform)} · ${projectStatusLabel(project.status)} · ${project.selectedHook?.text ?? "текст ещё не выбран"}`)
      .join("\n"),
    { reply_markup: keyboard }
  );
}

function projectActionLabel(status: string) {
  if (status === "GENERATION_PENDING") return "Посмотреть статус";
  if (status === "COMPLETED") return "Открыть результат";
  return "Продолжить";
}
