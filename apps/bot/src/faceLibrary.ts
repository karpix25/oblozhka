import { listUserFaceAssets, prisma, upsertTelegramUser } from "@covers/db";
import { InputFile } from "grammy";
import { faceUploadGuidePath } from "./assets.js";
import { sendFaceGallery } from "./faceGallery.js";
import { deleteCallbackMessage } from "./navigation.js";
import { facesKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export async function sendFaceLibrary(ctx: BotContext) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const faces = await listUserFaceAssets(prisma, user.id, 10);
  const keyboard = facesKeyboard();

  if (faces.length === 0) {
    await ctx.replyWithPhoto(new InputFile(faceUploadGuidePath()), {
      caption: "Сохранённых лиц пока нет. Загрузите фото во время создания обложки, и я сохраню его для следующих проектов.",
      reply_markup: keyboard
    });
    return;
  }

  await sendFaceGallery(ctx, faces, { mode: "browse" });
}

export async function openFaceLibrary(ctx: BotContext, input: { fromCallback?: boolean } = {}) {
  if (input.fromCallback) {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
  }
  await sendFaceLibrary(ctx);
}
