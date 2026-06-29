import type { BotContext } from "./session.js";

export async function deleteCallbackMessage(ctx: BotContext) {
  await ctx.deleteMessage().catch(() => undefined);
}
