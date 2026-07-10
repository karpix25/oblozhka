import { MODERNIZATION_ACTIONS, modernizationActionLabel, type PaidPlan } from "@covers/domain";
import { InlineKeyboard, InputMediaBuilder } from "grammy";
import { toTelegramPhotoUrl } from "./mediaUrls.js";
import { backHomeKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";

export type CoverGalleryItem = {
  id: string;
  previewUrl: string | null;
  originalUrl: string | null;
  hookText: string | null;
  topic: string;
  style: string;
  createdAt: Date;
  template?: { title: string | null; slug: string } | null;
  userStyleAsset?: { title: string | null } | null;
};

export async function sendCoverGallery(
  ctx: BotContext,
  covers: CoverGalleryItem[],
  input: { page?: number; replace?: boolean; plan?: PaidPlan | null } = {}
) {
  if (covers.length === 0) {
    await ctx.reply("Готовых обложек пока нет. Создайте первую, и я сохраню её здесь.", {
      reply_markup: backHomeKeyboard("home")
    });
    return;
  }

  const page = normalizePage(input.page ?? 0, covers.length);
  const cover = covers[page];
  const photoUrl = cover.previewUrl ? toTelegramPhotoUrl(cover.previewUrl) : null;
  const caption = coverCaption(cover, page, covers.length);
  const keyboard = coverGalleryKeyboard({ cover, page, total: covers.length, plan: input.plan });

  if (input.replace && photoUrl) {
    const edited = await editCoverGalleryMessage(ctx, photoUrl, caption, keyboard);
    if (edited) return;
  }

  if (photoUrl) {
    await ctx.replyWithPhoto(photoUrl, { caption, reply_markup: keyboard });
    return;
  }

  await ctx.reply(`${caption}\n\nПревью временно недоступно, но финальный файл можно открыть кнопкой ниже.`, {
    reply_markup: keyboard
  });
}

function coverGalleryKeyboard(input: { cover: CoverGalleryItem; page: number; total: number; plan?: PaidPlan | null }) {
  const keyboard = new InlineKeyboard();

  if (input.total > 1) {
    keyboard
      .text("⬅️ Предыдущая", `covers:browse:${input.page - 1}`)
      .text(`${input.page + 1} из ${input.total}`, "covers:noop")
      .text("Следующая ➡️", `covers:browse:${input.page + 1}`)
      .row();
  }

  const finalUrl = input.cover.originalUrl ? toTelegramPhotoUrl(input.cover.originalUrl) : null;
  if (finalUrl) {
    keyboard.url("⬇️ Открыть PNG", finalUrl).row();
  }

  MODERNIZATION_ACTIONS.forEach((action) => {
    keyboard.text(modernizationActionLabel(action, input.plan), `modernize:${action.id}:${input.cover.id}`).row();
  });
  keyboard.text("🎨 Создать ещё", "project:start").row();
  keyboard.text("🏠 В начало", "home");
  return keyboard;
}

async function editCoverGalleryMessage(ctx: BotContext, photo: string, caption: string, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageMedia(InputMediaBuilder.photo(photo, { caption }), { reply_markup: keyboard });
    return true;
  } catch {
    await ctx.deleteMessage().catch(() => undefined);
    return false;
  }
}

function coverCaption(cover: CoverGalleryItem, page: number, total: number) {
  return [
    `Обложка ${page + 1} из ${total}`,
    "",
    cover.hookText ? `Текст: ${cover.hookText}` : `Тема: ${cover.topic}`,
    `Стиль: ${cover.template?.title ?? cover.userStyleAsset?.title ?? cover.style}`,
    cover.createdAt.toLocaleDateString("ru-RU")
  ].join("\n");
}

function normalizePage(page: number, total: number) {
  if (page < 0) return total - 1;
  if (page >= total) return 0;
  return page;
}
