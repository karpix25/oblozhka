import {
  createUserFaceAsset,
  findProject,
  findUserFaceAsset,
  listUserFaceAssets,
  prisma,
  updateUserFaceAssetUrl,
  upsertTelegramUser
} from "@covers/db";
import { InlineKeyboard } from "grammy";
import { referenceForGenerationPrompt } from "./messages.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

type TelegramPhoto = {
  file_id: string;
};

export async function askReferenceForGeneration(ctx: BotContext) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const project = ctx.session.projectId ? await findProject(prisma, ctx.session.projectId) : null;
  const faces = project?.platform === "FACELESS" ? [] : await listUserFaceAssets(prisma, user.id, 6);
  ctx.session.step = "referenceUpload";
  await ctx.reply(referenceForGenerationPrompt(), { reply_markup: referenceFaceKeyboard(faces) });
}

export async function useSavedReferenceFace(ctx: BotContext, faceId: string, token: string) {
  if (!ctx.session.projectId) {
    await ctx.answerCallbackQuery("Сначала создайте проект.");
    return undefined;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const face = await findUserFaceAsset(prisma, faceId, user.id);
  if (!face) {
    await ctx.answerCallbackQuery("Это лицо не найдено.");
    return undefined;
  }

  const refreshed = face.telegramFileId ? await refreshTelegramFaceUrl(ctx, face, token) : face;
  await ctx.answerCallbackQuery("Лицо выбрано.");
  return refreshed.imageUrl;
}

export async function saveUploadedReferenceFace(
  ctx: BotContext,
  input: { token: string; photo: TelegramPhoto; filePath: string }
) {
  if (!ctx.session.projectId) return;

  const project = await findProject(prisma, ctx.session.projectId);
  if (project?.platform === "FACELESS") return;

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  await createUserFaceAsset(prisma, {
    userId: user.id,
    imageUrl: telegramFileUrl(input.token, input.filePath),
    telegramFileId: input.photo.file_id,
    title: `Моё лицо ${new Date().toLocaleDateString("ru-RU")}`,
    metadata: {
      role: "primary-reference",
      telegramFilePath: input.filePath,
      projectId: ctx.session.projectId
    }
  });
}

function referenceFaceKeyboard(faces: Array<{ id: string; title: string | null; createdAt: Date }>) {
  const keyboard = new InlineKeyboard();
  faces.forEach((face, index) => {
    keyboard.text(face.title ?? `Лицо ${index + 1}`, `referenceface:use:${face.id}`).row();
  });
  keyboard.text("Загрузить новое фото", "referenceface:upload").row().text("В начало", "home");
  return keyboard;
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

function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
