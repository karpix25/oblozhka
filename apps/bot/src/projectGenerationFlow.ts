import { createGenerationFromProject, prisma } from "@covers/db";
import { insufficientCreditsMessage } from "./billingMessages.js";
import { enqueueGenerationOrCompensate } from "./generationQueueing.js";
import { backHomeKeyboard, insufficientCreditsKeyboard } from "./sectionKeyboards.js";
import type { BotContext } from "./session.js";

export async function createAndEnqueueProjectGeneration(
  ctx: BotContext,
  input: { userId: string; referenceImageUrl: string }
) {
  if (!ctx.session.projectId) return false;

  try {
    const generation = await createGenerationFromProject(prisma, {
      projectId: ctx.session.projectId,
      userId: input.userId,
      referenceImageUrl: input.referenceImageUrl,
      chargeCredits: true
    });
    await enqueueGenerationOrCompensate(generation, ctx.from!.id);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать генерацию.";
    const isInsufficientCredits = message === "Insufficient credits.";
    await ctx.reply(isInsufficientCredits ? insufficientCreditsMessage() : message, {
      reply_markup: isInsufficientCredits ? insufficientCreditsKeyboard() : backHomeKeyboard("tariffs")
    });
    return false;
  }
}
