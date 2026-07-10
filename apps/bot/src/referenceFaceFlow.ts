import {
  countUserFaceAssets,
  findProject,
  findUserFaceAsset,
  getBillingAccess,
  listUserFaceAssets,
  prisma,
  updateUserFaceAssetUrl,
  upsertTelegramUser
} from "@covers/db";
import { isGeneratedFaceCardMetadata } from "@covers/domain";
import { avatarLimitMessage } from "./billingMessages.js";
import { createQueuedFaceAsset } from "./faceAssetUploads.js";
import { sendFaceGallery } from "./faceGallery.js";
import { referenceForGenerationPrompt } from "./messages.js";
import { backHomeKeyboard } from "./sectionKeyboards.js";
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
  ctx.session.faceGalleryMode = "reference";
  if (faces.length === 0) {
    await ctx.reply(referenceForGenerationPrompt(), { reply_markup: backHomeKeyboard("project:back:templates") });
    return;
  }
  await sendFaceGallery(ctx, faces, { mode: "reference" });
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
  const access = await getBillingAccess(prisma, user.id);
  const faceCount = await countUserFaceAssets(prisma, user.id);
  if (access.avatarLimit !== null && faceCount >= access.avatarLimit) {
    await ctx.reply(avatarLimitMessage(access.avatarLimit), { reply_markup: backHomeKeyboard("tariffs") });
    return false;
  }

  const sourceImageUrl = telegramFileUrl(input.token, input.filePath);
  const face = await createQueuedFaceAsset({
    sourceImageUrl,
    telegramFilePath: input.filePath,
    userId: user.id,
    telegramFileId: input.photo.file_id,
    title: `Аватар ${new Date().toLocaleDateString("ru-RU")}`,
    role: "primary-reference",
    projectId: ctx.session.projectId
  });

  return face;
}

async function refreshTelegramFaceUrl(
  ctx: BotContext,
  face: { id: string; telegramFileId: string | null; imageUrl: string; metadata: unknown },
  token: string
) {
  if (isGeneratedFaceCardMetadata(face.metadata)) return face;
  if (!face.telegramFileId) return face;
  const file = await ctx.api.getFile(face.telegramFileId);
  if (!file.file_path) return face;
  return updateUserFaceAssetUrl(prisma, face.id, telegramFileUrl(token, file.file_path), {
    ...(typeof face.metadata === "object" && face.metadata ? face.metadata : {}),
    sourceTelegramFilePath: file.file_path,
    refreshedAt: new Date().toISOString()
  });
}

function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
