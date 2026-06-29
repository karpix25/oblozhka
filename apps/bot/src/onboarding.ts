import { InputFile } from "grammy";
import { onboardingImagePath } from "./assets.js";
import { mainKeyboard } from "./keyboards.js";
import { startMessage } from "./messages.js";
import type { BotContext } from "./session.js";

export async function sendOnboarding(ctx: BotContext, firstName?: string) {
  await ctx.replyWithPhoto(new InputFile(onboardingImagePath()), {
    caption: startMessage(firstName),
    reply_markup: mainKeyboard()
  });
}
