import { listUserProjects, prisma, upsertTelegramUser } from "@covers/db";
import { mainKeyboard } from "./keyboards.js";
import { deleteCallbackMessage } from "./navigation.js";
import { platformLabel, projectStatusLabel } from "./projectLabels.js";
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
    await ctx.reply("Пока нет проектов. Начните с кнопки «Создать обложку».", { reply_markup: mainKeyboard() });
    return;
  }

  await ctx.reply(
    projects
      .map((project, index) => `${index + 1}. ${platformLabel(project.platform)} · ${projectStatusLabel(project.status)} · ${project.selectedHook?.text ?? "текст еще не выбран"}`)
      .join("\n")
  );
}
