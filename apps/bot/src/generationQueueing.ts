import { markGenerationFailed, markProjectStatus, prisma } from "@covers/db";
import type { GenerationJobData } from "@covers/domain";
import type { Queue } from "bullmq";
import { generationJobId } from "./jobIds.js";

type QueuedGeneration = {
  id: string;
  queuePriority: number;
  projectId?: string | null;
};

type EnqueueDeps = {
  queue: Pick<Queue<GenerationJobData, void, string>, "add">;
  markFailed: typeof markGenerationFailed;
  markProject: typeof markProjectStatus;
};

export class GenerationEnqueueError extends Error {
  constructor(
    message: string,
    readonly details: { compensationSucceeded: boolean; enqueueError: unknown; compensationError?: unknown }
  ) {
    super(message);
    this.name = "GenerationEnqueueError";
  }
}

export async function enqueueGenerationOrCompensate(
  generation: QueuedGeneration,
  userTelegramId: number,
  deps?: EnqueueDeps
) {
  const resolvedDeps = deps ?? await defaultEnqueueDeps();
  try {
    await resolvedDeps.queue.add(
      "generate-cover",
      { generationId: generation.id, userTelegramId },
      {
        jobId: generationJobId(generation.id),
        priority: generation.queuePriority
      }
    );
  } catch (enqueueError) {
    await compensateGenerationEnqueueFailure(generation, enqueueError, resolvedDeps);
  }
}

async function defaultEnqueueDeps(): Promise<EnqueueDeps> {
  const { generationQueue } = await import("./queue.js");
  return {
    queue: generationQueue,
    markFailed: markGenerationFailed,
    markProject: markProjectStatus
  };
}

async function compensateGenerationEnqueueFailure(
  generation: QueuedGeneration,
  enqueueError: unknown,
  deps: EnqueueDeps
) {
  try {
    const message = enqueueFailureMessage(enqueueError);
    await deps.markFailed(prisma, generation.id, message);
    if (generation.projectId) {
      await deps.markProject(prisma, generation.projectId, "FAILED", message);
    }
    throw new GenerationEnqueueError("Очередь генераций временно недоступна. Кредит возвращён, попробуйте ещё раз через минуту.", {
      compensationSucceeded: true,
      enqueueError
    });
  } catch (compensationError) {
    if (compensationError instanceof GenerationEnqueueError) {
      throw compensationError;
    }
    throw new GenerationEnqueueError("Очередь генераций временно недоступна. Я не смог автоматически вернуть кредит, напишите в поддержку.", {
      compensationSucceeded: false,
      enqueueError,
      compensationError
    });
  }
}

function enqueueFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown enqueue error";
  return `Generation queue enqueue failed: ${message}`;
}
