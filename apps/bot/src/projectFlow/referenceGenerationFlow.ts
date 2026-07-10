import { prisma, upsertTelegramUser } from "@covers/db";
import type { BotAbuseGuard } from "../abuseGuard.js";
import { saveUploadedGuestFace } from "../guestFaceFlow.js";
import { createAndEnqueueProjectGeneration } from "../projectGenerationFlow.js";
import { hookJobId, hookQueue } from "../queue.js";
import { saveUploadedReferenceFace } from "../referenceFaceFlow.js";
import { backHomeKeyboard } from "../sectionKeyboards.js";
import { resetWizard, type BotContext } from "../session.js";
import { saveUploadedStyle } from "../styleLibrary.js";
import { profileFromContext } from "../userProfile.js";
import { trackProductEvent } from "./analytics.js";
import { telegramFileUrl } from "./sourceFlow.js";

export async function handleProjectPhoto(ctx: BotContext, token: string, abuseGuard: BotAbuseGuard) {
  if (ownsProjectPhotoFlow(ctx) && !(await abuseGuard.consume(ctx, "asset-upload"))) return true;
  if (await saveUploadedStyle(ctx, token)) return true;

  const guestFaceResult = await saveUploadedGuestFace(ctx, token);
  if (guestFaceResult === "saved") {
    if (!(await abuseGuard.consume(ctx, "hook-generation"))) return true;
    await hookQueue.add(
      "generate-hooks",
      { projectId: ctx.session.projectId!, userTelegramId: ctx.from!.id },
      { jobId: hookJobId(ctx.session.projectId!) }
    );
    await ctx.reply("Сохранил второе лицо. Анализирую ролик и сам выберу самый сильный текст для обложки.");
    return true;
  }
  if (guestFaceResult === "handled") return true;
  if (!ctx.session.projectId || ctx.session.step !== "referenceUpload") return false;

  const photo = ctx.message?.photo?.at(-1);
  if (!photo) return false;
  const file = await ctx.api.getFile(photo.file_id);
  if (!file.file_path) {
    await ctx.reply("Не получилось прочитать фото. Попробуйте отправить изображение ещё раз.", {
      reply_markup: backHomeKeyboard("project:back:templates")
    });
    return true;
  }

  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const fallbackImageUrl = telegramFileUrl(token, file.file_path);
  await ctx.reply("Принял фото. Сохраняю лицо и сразу запускаю обложку · 1 генерация.");
  const face = await saveUploadedReferenceFace(ctx, { token, photo, filePath: file.file_path });
  if (face === false) return true;

  if (await createAndEnqueueProjectGeneration(ctx, {
    userId: user.id,
    referenceImageUrl: face?.imageUrl ?? fallbackImageUrl
  })) {
    trackProductEvent("reference_selected", { userId: user.id, projectId: ctx.session.projectId, metadata: { source: "upload" } });
    trackProductEvent("generation_started", { userId: user.id, projectId: ctx.session.projectId });
    resetWizard(ctx);
    await ctx.reply("Аватар сохранён. Собираю обложку в выбранном стиле.");
  }
  return true;
}

export async function enqueueGenerationFromReference(
  ctx: BotContext,
  referenceImageUrl: string,
  abuseGuard: BotAbuseGuard
) {
  if (!ctx.session.projectId || !(await abuseGuard.consume(ctx, "cover-generation"))) return;
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  if (await createAndEnqueueProjectGeneration(ctx, { userId: user.id, referenceImageUrl })) {
    trackProductEvent("generation_started", { userId: user.id, projectId: ctx.session.projectId });
    resetWizard(ctx);
    await ctx.reply("Взял сохранённое лицо. Собираю обложку в выбранном стиле.");
  }
}

function ownsProjectPhotoFlow(ctx: BotContext) {
  return (
    ctx.session.step === "styleUpload" ||
    ctx.session.step === "guestFaceUpload" ||
    Boolean(ctx.session.projectId && ctx.session.step === "referenceUpload")
  );
}
