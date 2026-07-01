import { listUserFaceAssets, prisma, upsertTelegramUser } from "@covers/db";
import { mainKeyboard } from "./keyboards.js";
import { deleteCallbackMessage } from "./navigation.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export async function sendFaceLibrary(ctx: BotContext) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const faces = await listUserFaceAssets(prisma, user.id, 10);
  await ctx.answerCallbackQuery();
  await deleteCallbackMessage(ctx);

  if (faces.length === 0) {
    await ctx.reply("Сохранённых лиц пока нет. Загрузите фото во время создания обложки, и я сохраню его для следующих проектов.", {
      reply_markup: mainKeyboard()
    });
    return;
  }

  await ctx.reply(
    [
      "Сохранённые лица:",
      "",
      ...faces.map((face, index) => `${index + 1}. ${face.title ?? "Лицо"} · ${face.createdAt.toLocaleDateString("ru-RU")}`),
      "",
      "При создании обложки я предложу быстрый выбор этих фото."
    ].join("\n"),
    { reply_markup: mainKeyboard() }
  );
}
