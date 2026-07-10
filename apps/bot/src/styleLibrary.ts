import {
  createUserStyleAsset,
  findUserStyleAsset,
  getBillingAccess,
  listUserStyleAssets,
  prisma,
  setProjectUserStyleAsset,
  upsertTelegramUser
} from "@covers/db";
import { InlineKeyboard } from "grammy";
import { deleteCallbackMessage } from "./navigation.js";
import { canUseCustomStyle, customStyleUploadLabel } from "./planUi.js";
import { backHomeKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export async function openStyleLibrary(ctx: BotContext, input: { fromCallback?: boolean; selectForProject?: boolean } = {}) {
  if (input.fromCallback) {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  if (!canUseCustomStyle(access)) {
    await ctx.reply(customStyleUpsellMessage(), { reply_markup: customStyleUpsellKeyboard(input.selectForProject) });
    return;
  }

  const styles = await listUserStyleAssets(prisma, { userId: user.id, statuses: ["READY"], take: 20 });
  if (styles.length === 0) {
    await ctx.reply("Своих стилей пока нет. Загрузите референс-обложку, и я сохраню её стиль для следующих генераций.", {
      reply_markup: styleLibraryKeyboard({ access, hasStyles: false, selectForProject: Boolean(input.selectForProject) })
    });
    return;
  }

  await ctx.reply("Ваши стили:", {
    reply_markup: styleListKeyboard(styles, { access, selectForProject: Boolean(input.selectForProject) })
  });
}

type StyleUploadOptions = {
  deleteSourceMessage?: boolean;
  prompt?: string;
};

export async function startStyleUpload(ctx: BotContext, options: StyleUploadOptions = {}) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  if (!canUseCustomStyle(access)) {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await ctx.reply(customStyleUpsellMessage(), { reply_markup: customStyleUpsellKeyboard() });
    return;
  }
  ctx.session.step = "styleUpload";
  await ctx.answerCallbackQuery().catch(() => undefined);
  if (options.deleteSourceMessage !== false) {
    await deleteCallbackMessage(ctx).catch(() => undefined);
  }
  await ctx.reply(options.prompt ?? "Отправьте картинку-референс: обложку или кадр, стиль которого нужно сохранить.", {
    reply_markup: backHomeKeyboard(ctx.session.projectId ? "project:back:style-source" : "home")
  });
}

export async function saveUploadedStyle(ctx: BotContext, token: string) {
  if (ctx.session.step !== "styleUpload") return false;
  const photo = ctx.message?.photo?.at(-1);
  if (!photo) return false;

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const file = await ctx.api.getFile(photo.file_id);
  if (!file.file_path) {
    await ctx.reply("Не получилось прочитать картинку. Попробуйте отправить изображение ещё раз.", {
      reply_markup: backHomeKeyboard(ctx.session.projectId ? "project:back:style-source" : "home")
    });
    return true;
  }

  const imageUrl = telegramFileUrl(token, file.file_path);
  await createUserStyleAsset(prisma, {
    userId: user.id,
    sourceImageUrl: imageUrl,
    title: `Стиль ${new Date().toLocaleDateString("ru-RU")}`,
    promptRules: defaultStylePromptRules(),
    status: "READY",
    metadata: {
      telegramFileId: photo.file_id,
      sourceTelegramFilePath: file.file_path
    }
  });
  ctx.session.step = "idle";
  const access = await getBillingAccess(prisma, user.id);
  await ctx.reply("Стиль сохранён. Теперь его можно выбрать при создании обложки.", {
    reply_markup: styleLibraryKeyboard({ access, hasStyles: true, selectForProject: Boolean(ctx.session.projectId) })
  });
  return true;
}

export async function selectUserStyleForProject(ctx: BotContext, styleId: string) {
  if (!ctx.session.projectId) {
    await ctx.answerCallbackQuery("Сначала создайте проект.");
    return false;
  }
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const style = await findUserStyleAsset(prisma, { id: styleId, userId: user.id });
  if (!style || style.status !== "READY") {
    await ctx.answerCallbackQuery("Стиль не найден или ещё не готов.");
    return false;
  }
  await setProjectUserStyleAsset(prisma, ctx.session.projectId, style.id);
  await ctx.answerCallbackQuery("Стиль выбран.");
  return true;
}

function styleLibraryKeyboard(input: {
  access: Awaited<ReturnType<typeof getBillingAccess>>;
  hasStyles: boolean;
  selectForProject?: boolean;
}) {
  const keyboard = new InlineKeyboard().text(customStyleUploadLabel(input.access), "styles:upload");
  if (input.hasStyles) keyboard.row().text("🎨 Создать обложку", "project:start");
  if (input.selectForProject) keyboard.row().text("⬅️ Назад", "project:back:style-source");
  keyboard.text("🏠 В начало", "home");
  return keyboard;
}

function styleListKeyboard(
  styles: Array<{ id: string; title: string | null }>,
  input: { access: Awaited<ReturnType<typeof getBillingAccess>>; selectForProject: boolean }
) {
  const keyboard = new InlineKeyboard();
  styles.forEach((style) => keyboard.text(style.title ?? "Пользовательский стиль", `style:use:${style.id}`).row());
  keyboard.text(customStyleUploadLabel(input.access), "styles:upload").row();
  if (!input.selectForProject) keyboard.text("🎨 Создать обложку", "project:start").row();
  if (input.selectForProject) keyboard.text("⬅️ Назад", "project:back:style-source").row();
  keyboard.text("🏠 В начало", "home");
  return keyboard;
}

function customStyleUpsellKeyboard(selectForProject = false) {
  const keyboard = new InlineKeyboard().text("⭐ Выбрать тариф", "packages").row();
  if (selectForProject) {
    keyboard.text("🖼 Выбрать шаблон", "style-source:library").row();
  }
  return keyboard.text("💳 Все тарифы", "tariffs").text("🏠 В начало", "home");
}

function customStyleUpsellMessage() {
  return [
    "Свой стиль доступен на тарифах Pro и Business.",
    "",
    "Кнопка видна заранее, но на текущем тарифе она закрыта. После апгрейда вы сможете загрузить референс-обложку, сохранить её стиль и применять его к новым генерациям."
  ].join("\n");
}

function defaultStylePromptRules() {
  return [
    "Use the uploaded style reference only as a visual style guide.",
    "Preserve its composition rhythm, contrast level, color palette, typography feel, text zones, subject scale and background depth.",
    "Do not copy exact text, logos, faces, facial features, hair, expressions, body identity, brands or unique protected content from the style reference.",
    "If a user's face reference is provided, that face reference is the only source of human likeness; the style reference must not influence the person's identity.",
    "Adapt the style to the current topic and selected hook while keeping the final thumbnail original and readable."
  ].join(" ");
}

function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
