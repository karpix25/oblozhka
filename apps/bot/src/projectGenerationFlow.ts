import { createGenerationFromProject, prisma } from "@covers/db";
import { insufficientCreditsMessage } from "./billingMessages.js";
import { generationJobId, generationQueue } from "./queue.js";
import { backHomeKeyboard } from "./sectionKeyboards.js";
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
    await generationQueue.add("generate-cover", { generationId: generation.id, userTelegramId: ctx.from!.id }, {
      jobId: generationJobId(generation.id),
      priority: generation.queuePriority
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать генерацию.";
    await ctx.reply(message === "Insufficient credits." ? insufficientCreditsMessage() : message, {
      reply_markup: backHomeKeyboard("tariffs")
    });
    return false;
  }
}
