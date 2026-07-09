import { InlineKeyboard, InputMediaBuilder } from "grammy";
import { toTelegramPhotoUrl } from "./mediaUrls.js";
import { backHomeKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";

export type FaceGalleryMode = "browse" | "reference" | "guest";

export type FaceGalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  createdAt: Date;
};

export async function sendFaceGallery(
  ctx: BotContext,
  faces: FaceGalleryItem[],
  input: { mode: FaceGalleryMode; page?: number; replace?: boolean }
) {
  if (faces.length === 0) {
    await ctx.reply(emptyCaption(input.mode), { reply_markup: backHomeKeyboard() });
    return;
  }

  const page = normalizePage(input.page ?? 0, faces.length);
  const face = faces[page];
  const caption = faceCaption(face, page, faces.length);
  const keyboard = faceGalleryKeyboard({ mode: input.mode, page, total: faces.length, faceId: face.id });
  const photoUrl = toTelegramPhotoUrl(face.imageUrl);

  if (input.replace && photoUrl) {
    const edited = await editFaceGalleryMessage(ctx, photoUrl, caption, keyboard);
    if (edited) return;
  }

  if (photoUrl) {
    await ctx.replyWithPhoto(photoUrl, { caption, reply_markup: keyboard });
    return;
  }

  await ctx.reply(`${caption}\n\nНе получилось открыть изображение аватара. Загрузите новое фото.`, {
    reply_markup: keyboard
  });
}

function faceGalleryKeyboard(input: { mode: FaceGalleryMode; page: number; total: number; faceId: string }) {
  const keyboard = new InlineKeyboard();

  if (input.total > 1) {
    keyboard
      .text("Назад", `faces:browse:${input.mode}:${input.page - 1}`)
      .text(`${input.page + 1}/${input.total}`, "faces:noop")
      .text("Вперёд", `faces:browse:${input.mode}:${input.page + 1}`)
      .row();
  }

  if (input.mode === "reference") {
    keyboard.text("✅ Выбрать этот аватар", `referenceface:use:${input.faceId}`).row();
  }
  if (input.mode === "guest") {
    keyboard.text("✅ Выбрать этого гостя", `guestface:use:${input.faceId}`).row();
  }

  if (input.mode === "browse") {
    keyboard.text("🎨 Создать обложку", "project:start").row();
  } else {
    keyboard.text("📤 Загрузить новое фото", uploadCallback(input.mode)).row();
  }

  keyboard.text("🏠 В начало", "home");
  return keyboard;
}

async function editFaceGalleryMessage(
  ctx: BotContext,
  photo: string,
  caption: string,
  keyboard: InlineKeyboard
) {
  try {
    await ctx.editMessageMedia(InputMediaBuilder.photo(photo, { caption }), { reply_markup: keyboard });
    return true;
  } catch {
    await ctx.deleteMessage().catch(() => undefined);
    return false;
  }
}

function faceCaption(face: FaceGalleryItem, page: number, total: number) {
  return [`Аватар ${page + 1}/${total}`, "", face.title ?? "Сохранённое лицо", face.createdAt.toLocaleDateString("ru-RU")].join(
    "\n"
  );
}

function emptyCaption(mode: FaceGalleryMode) {
  if (mode === "guest") return "Сохранённых гостей пока нет. Загрузите фото второго человека.";
  return "Сохранённых аватаров пока нет. Загрузите фото, и я сначала соберу карту лица.";
}

function uploadCallback(mode: FaceGalleryMode) {
  return mode === "guest" ? "guestface:upload" : "referenceface:upload";
}

function normalizePage(page: number, total: number) {
  if (page < 0) return total - 1;
  if (page >= total) return 0;
  return page;
}
