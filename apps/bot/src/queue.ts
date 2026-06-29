import { GENERATION_QUEUE, HOOK_QUEUE, type GenerationJobData, type HookJobData } from "@covers/domain";
import { Queue } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const generationQueue = new Queue<GenerationJobData, void, string>(GENERATION_QUEUE, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null
  },
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: 100
  }
});

export const hookQueue = new Queue<HookJobData, void, string>(HOOK_QUEUE, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null
  },
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: 100
  }
});

export function hookJobId(projectId: string) {
  return `hooks-${safeJobIdPart(projectId)}`;
}

export function generationJobId(generationId: string) {
  return `generation-${safeJobIdPart(generationId)}`;
}

function safeJobIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
