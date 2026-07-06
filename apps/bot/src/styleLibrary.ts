import {
  createUserStyleAsset,
  findUserStyleAsset,
  getBillingAccess,
  listUserStyleAssets,
  prisma,
  setProjectUserStyleAsset,
  upsertTelegramUser
} from "@covers/db";
import { canUseEntitlement } from "@covers/domain";
import { InlineKeyboard } from "grammy";
import { deleteCallbackMessage } from "./navigation.js";
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
  if (!canUseEntitlement(entitlementSubject(access), "CUSTOM_STYLE_UPLOAD")) {
    await ctx.reply(customStyleUpsellMessage(), { reply_markup: customStyleUpsellKeyboard() });
    return;
  }

  const styles = await listUserStyleAssets(prisma, { userId: user.id, statuses: ["READY"], take: 20 });
  if (styles.length === 0) {
    await ctx.reply("Своих стилей пока нет. Загрузите референс-обложку, и я сохраню её стиль для следующих генераций.", {
      reply_markup: styleLibraryKeyboard({ hasStyles: false })
    });
    return;
  }

  await ctx.reply("Ваши стили:", {
    reply_markup: styleListKeyboard(styles, Boolean(input.selectForProject))
  });
}

export async function startStyleUpload(ctx: BotContext) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  if (!canUseEntitlement(entitlementSubject(access), "CUSTOM_STYLE_UPLOAD")) {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await ctx.reply(customStyleUpsellMessage(), { reply_markup: customStyleUpsellKeyboard() });
    return;
  }
  ctx.session.step = "styleUpload";
  await ctx.answerCallbackQuery().catch(() => undefined);
  await deleteCallbackMessage(ctx).catch(() => undefined);
  await ctx.reply("Отправьте картинку-референс: обложку или кадр, стиль которого нужно сохранить.", {
    reply_markup: backHomeKeyboard()
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
      reply_markup: backHomeKeyboard()
    });
    return true;
  }

  const imageUrl = telegramFileUrl(token, file.file_path);
  await createUserStyleAsset(prisma, {
    userId: user.id,
    sourceImageUrl: imageUrl,
    title: `Стиль ${new Date().toLocaleDateString("ru-RU")}`,
    promptRules: defaultStylePromptRules(),
    metadata: {
      telegramFileId: photo.file_id,
      sourceTelegramFilePath: file.file_path
    }
  });
  ctx.session.step = "idle";
  await ctx.reply("Стиль сохранён. Теперь его можно выбрать при создании обложки.", {
    reply_markup: styleLibraryKeyboard({ hasStyles: true })
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

function styleLibraryKeyboard(input: { hasStyles: boolean }) {
  const keyboard = new InlineKeyboard().text("➕ Загрузить стиль", "styles:upload");
  if (input.hasStyles) keyboard.row().text("🎨 Создать обложку", "project:start");
  keyboard.row().text("🏠 В начало", "home");
  return keyboard;
}

function styleListKeyboard(styles: Array<{ id: string; title: string | null }>, selectForProject: boolean) {
  const keyboard = new InlineKeyboard();
  styles.forEach((style) => keyboard.text(style.title ?? "Пользовательский стиль", `style:use:${style.id}`).row());
  keyboard.text("➕ Загрузить стиль", "styles:upload").row();
  if (!selectForProject) keyboard.text("🎨 Создать обложку", "project:start").row();
  keyboard.text("🏠 В начало", "home");
  return keyboard;
}

function customStyleUpsellKeyboard() {
  return new InlineKeyboard().text("⭐ Выбрать тариф", "packages").row().text("💳 Все тарифы", "tariffs").text("🏠 В начало", "home");
}

function customStyleUpsellMessage() {
  return [
    "Свой стиль доступен на тарифах Pro и Business.",
    "",
    "Вы сможете загрузить референс-обложку, сохранить её стиль и применять его к новым генерациям."
  ].join("\n");
}

function entitlementSubject(access: Awaited<ReturnType<typeof getBillingAccess>>) {
  return access.kind === "subscription" ? { kind: "subscription" as const, plan: access.plan } : { kind: "trial" as const };
}

function defaultStylePromptRules() {
  return [
    "Use the uploaded style reference only as a visual style guide.",
    "Preserve its composition rhythm, contrast level, color palette, typography feel, text zones, subject scale and background depth.",
    "Do not copy exact text, logos, faces, brands or unique protected content from the style reference.",
    "Adapt the style to the current topic and selected hook while keeping the final thumbnail original and readable."
  ].join(" ");
}

function telegramFileUrl(token: string, filePath: string) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
