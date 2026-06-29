import type { BotContext } from "./session.js";

export function profileFromContext(ctx: BotContext) {
  if (!ctx.from) {
    throw new Error("Telegram user is missing from context.");
  }

  return {
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    languageCode: ctx.from.language_code
  };
}
