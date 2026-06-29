import {
  createUserFaceAsset,
  findUserFaceAsset,
  listUserFaceAssets,
  prisma,
  setProjectGuestFaceAsset,
  updateUserFaceAssetUrl,
  upsertTelegramUser
} from "@covers/db";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export function requiresGuestFace(template?: { slug?: string | null } | null) {
  return template?.slug === "podcast-countdown";
}

export async function askGuestFace(ctx: BotContext) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const faces = await listUserFaceAssets(prisma, user.id, 4);
  ctx.session.step = "guestFaceUpload";
  await ctx.reply(guestFacePrompt(), { reply_markup: guestFaceKeyboard(faces) });
}

export async function useSavedGuestFace(ctx: BotContext, faceId: string, token: string) {
  if (!ctx.session.projectId) {
    await ctx.answerCallbackQuery("Сначала создайте проект.");
    return false;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const face = await findUserFaceAsset(prisma, faceId, user.id);
  if (!face) {
    await ctx.answerCallbackQuery("Это лицо не найдено.");
    return false;
  }

  const refreshed = face.telegramFileId ? await refreshTelegramFaceUrl(ctx, face, token) : face;
  await setProjectGuestFaceAsset(prisma, ctx.session.projectId, refreshed.id);
  ctx.session.step = "idle";
  await ctx.answerCallbackQuery("Второе лицо выбрано.");
  return true;
}

export async function saveUploadedGuestFace(ctx: BotContext, token: string) {
  if (!ctx.session.projectId || ctx.session.step !== "guestFaceUpload") {
    return false;
  }

  const photo = ctx.message?.photo?.at(-1);
  if (!photo) {
    return false;
  }

  const file = await ctx.api.getFile(photo.file_id);
  if (!file.file_path) {
    await ctx.reply("Не получилось прочитать фото второго человека. Попробуйте другое изображение.");
    return true;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const imageUrl = telegramFileUrl(token, file.file_path);
  const face = await createUserFaceAsset(prisma, {
    userId: user.id,
    imageUrl,
    telegramFileId: photo.file_id,
    title: `Гость ${new Date().toLocaleDateString("ru-RU")}`,
    metadata: { telegramFilePath: file.file_path }
  });
  await setProjectGuestFaceAsset(prisma, ctx.session.projectId, face.id);
  ctx.session.step = "idle";
  await ctx.reply("Сохранил второе лицо. В следующих проектах предложу его быстрым выбором.");
  return true;
}

function guestFaceKeyboard(faces: Array<{ id: string; title: string | null; createdAt: Date }>) {
  const keyboard = new InlineKeyboard();
  faces.forEach((face, index) => {
    keyboard.text(face.title ?? `Гость ${index + 1}`, `guestface:use:${face.id}`).row();
  });
  keyboard.text("Загрузить новое фото", "guestface:upload").row().text("В начало", "home");
  return keyboard;
}

function guestFacePrompt() {
  return [
    "Для Podcast Countdown нужно второе лицо.",
    "",
    "Выберите сохранённого гостя или загрузите новое фото лица.",
    "Лучше: крупное лицо, нормальный свет, без сильных фильтров."
  ].join("\n");
}

function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

async function refreshTelegramFaceUrl(
  ctx: BotContext,
  face: { id: string; telegramFileId: string | null; imageUrl: string; metadata: unknown },
  token: string
) {
  if (!face.telegramFileId) return face;
  const file = await ctx.api.getFile(face.telegramFileId);
  if (!file.file_path) return face;
  return updateUserFaceAssetUrl(prisma, face.id, telegramFileUrl(token, file.file_path), {
    ...(typeof face.metadata === "object" && face.metadata ? face.metadata : {}),
    telegramFilePath: file.file_path,
    refreshedAt: new Date().toISOString()
  });
}
