import { getBillingAccess, listUserSucceededGenerations, prisma, upsertTelegramUser } from "@covers/db";
import { sendCoverGallery } from "../coverGallery.js";
import { deleteCallbackMessage } from "../navigation.js";
import type { BotContext } from "../session.js";
import { profileFromContext } from "../userProfile.js";

export async function openCoverHistory(
  ctx: BotContext,
  input: { fromCallback?: boolean; page?: number; replace?: boolean } = {}
) {
  const user = await upsertTelegramUser(prisma, profileFromContext(ctx));
  const access = await getBillingAccess(prisma, user.id);
  const covers = await listUserSucceededGenerations(prisma, { userId: user.id, take: 20 });
  if (input.fromCallback) {
    await ctx.answerCallbackQuery();
    await deleteCallbackMessage(ctx);
  }
  await sendCoverGallery(ctx, covers, {
    page: input.page,
    replace: input.replace,
    plan: access.kind === "trial" ? null : access.plan
  });
}
