import { InputFile } from "grammy";
import { onboardingImagePath } from "./assets.js";
import { bottomMenuKeyboard } from "./bottomMenu.js";
import { mainKeyboard } from "./keyboards.js";
import { startMessage } from "./messages.js";
import type { BotContext } from "./session.js";

type OnboardingMenu = "bottom" | "inline";

export async function sendOnboarding(ctx: BotContext, firstName?: string, menu: OnboardingMenu = "inline") {
  await ctx.replyWithPhoto(new InputFile(onboardingImagePath()), {
    caption: startMessage(firstName),
    reply_markup: menu === "bottom" ? bottomMenuKeyboard() : mainKeyboard()
  });
}
