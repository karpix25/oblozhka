import {
  countUserFaceAssets,
  findUserFaceAsset,
  getBillingAccess,
  listUserFaceAssets,
  prisma,
  setProjectGuestFaceAsset,
  updateUserFaceAssetUrl,
  upsertTelegramUser
} from "@covers/db";
import { designRequiresGuestFace, isGeneratedFaceCardMetadata } from "@covers/domain";
import { avatarLimitMessage } from "./billingMessages.js";
import { createQueuedFaceAsset } from "./faceAssetUploads.js";
import { sendFaceGallery } from "./faceGallery.js";
import type { BotContext } from "./session.js";
import { backHomeKeyboard } from "./sectionKeyboards.js";
import { profileFromContext } from "./userProfile.js";

export function requiresGuestFace(template?: { slug?: string | null } | null) {
  return designRequiresGuestFace(template);
}

export async function askGuestFace(ctx: BotContext) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const faces = await listUserFaceAssets(prisma, user.id, 4);
  ctx.session.step = "guestFaceUpload";
  ctx.session.faceGalleryMode = "guest";
  if (faces.length === 0) {
    await ctx.reply(guestFacePrompt(), { reply_markup: backHomeKeyboard() });
    return;
  }
  await sendFaceGallery(ctx, faces, { mode: "guest" });
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
    await ctx.reply("Не получилось прочитать фото второго человека. Попробуйте другое изображение.", {
      reply_markup: backHomeKeyboard()
    });
    return "handled";
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  const faceCount = await countUserFaceAssets(prisma, user.id);
  if (access.avatarLimit !== null && faceCount >= access.avatarLimit) {
    await ctx.reply(avatarLimitMessage(access.avatarLimit), { reply_markup: backHomeKeyboard("tariffs") });
    return "handled";
  }

  const sourceImageUrl = telegramFileUrl(token, file.file_path);
  const face = await createQueuedFaceAsset({
    sourceImageUrl,
    telegramFilePath: file.file_path,
    userId: user.id,
    telegramFileId: photo.file_id,
    title: `Гость ${new Date().toLocaleDateString("ru-RU")}`,
    role: "guest-reference"
  });
  await setProjectGuestFaceAsset(prisma, ctx.session.projectId, face.id);
  ctx.session.step = "idle";
  ctx.session.faceGalleryMode = undefined;
  await ctx.reply("Сохранил второе лицо. В следующих проектах предложу его быстрым выбором.");
  return "saved";
}

function guestFacePrompt() {
  return [
    "Для этого дизайн-референса нужно второе лицо.",
    "",
    "Выберите сохранённого гостя или загрузите новое фото лица.",
    "Я не буду брать лицо второго человека из шаблона — нужен отдельный референс.",
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
