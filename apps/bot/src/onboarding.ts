import { getBillingAccess, prisma, upsertTelegramUser } from "@covers/db";
import { InputFile } from "grammy";
import { onboardingImagePath } from "./assets.js";
import { mainKeyboard } from "./keyboards.js";
import { startMessage } from "./messages.js";
import type { BotContext } from "./session.js";
import { profileFromContext } from "./userProfile.js";

export async function sendOnboarding(ctx: BotContext, firstName?: string) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  await ctx.replyWithPhoto(new InputFile(onboardingImagePath()), {
    caption: startMessage(firstName),
    reply_markup: mainKeyboard(access)
  });
}
