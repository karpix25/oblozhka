import { Worker, type WorkerOptions } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const workerConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null
};

export function buildWorkerOptions(input: { concurrency: number; limiterMax: number; limiterDurationMs: number }): WorkerOptions {
  return {
    connection: workerConnection,
    concurrency: input.concurrency,
    limiter: input.limiterMax > 0 ? { max: input.limiterMax, duration: input.limiterDurationMs } : undefined,
    lockDuration: positiveIntegerEnv("WORKER_LOCK_DURATION_MS", 10 * 60 * 1000),
    maxStalledCount: positiveIntegerEnv("WORKER_MAX_STALLED_COUNT", 1),
    stalledInterval: positiveIntegerEnv("WORKER_STALLED_INTERVAL_MS", 30 * 1000)
  };
}

export function attachWorkerLogging<DataType, ResultType, NameType extends string>(
  queueName: string,
  worker: Worker<DataType, ResultType, NameType>
) {
  worker.on("completed", (job) => {
    console.info("Worker job completed", {
      queueName,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined
    });
  });

  worker.on("failed", (job, error, previousState) => {
    console.error("Worker job failed", {
      queueName,
      jobId: job?.id,
      jobName: job?.name,
      previousState,
      attemptsMade: job?.attemptsMade,
      attempts: job?.opts.attempts,
      error: formatError(error)
    });
  });

  worker.on("stalled", (jobId, previousState) => {
    console.warn("Worker job stalled", { queueName, jobId, previousState });
  });

  worker.on("error", (error) => {
    console.error("Worker runtime error", { queueName, error: formatError(error) });
  });
}

export function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function nonNegativeIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function withJobDeadline<T>(
  description: string,
  timeoutMs: number,
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeoutError = new Error(`${description} timed out after ${timeoutMs}ms.`);
  const actionPromise = action(controller.signal);
  const deadlinePromise = new Promise<never>((_, reject) => {
    const timeout = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
    actionPromise.then(
      () => clearTimeout(timeout),
      () => clearTimeout(timeout)
    );
  });

  return Promise.race([actionPromise, deadlinePromise]);
}

export function throwIfAborted(signal: AbortSignal, description: string) {
  if (signal.aborted) {
    throw new Error(`${description} was aborted by deadline.`);
  }
}

export function isFinalAttempt(job: { attemptsMade: number; opts: { attempts?: number } }) {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

function formatError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}
