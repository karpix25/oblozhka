import {
  FACE_CARD_QUEUE,
  GENERATION_QUEUE,
  HOOK_QUEUE,
  type FaceCardJobData,
  type GenerationJobData,
  type HookJobData
} from "@covers/domain";
import { Queue, type DefaultJobOptions } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5000
  },
  keepLogs: 25,
  stackTraceLimit: 10
};

export const generationQueue = new Queue<GenerationJobData, void, string>(GENERATION_QUEUE, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null
  },
  defaultJobOptions
});

export const hookQueue = new Queue<HookJobData, void, string>(HOOK_QUEUE, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null
  },
  defaultJobOptions
});

export const faceCardQueue = new Queue<FaceCardJobData, void, string>(FACE_CARD_QUEUE, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null
  },
  defaultJobOptions
});

export function hookJobId(projectId: string) {
  return `hooks-${safeJobIdPart(projectId)}`;
}

export function generationJobId(generationId: string) {
  return `generation-${safeJobIdPart(generationId)}`;
}

export function faceCardJobId(faceAssetId: string) {
  return `face-card-${safeJobIdPart(faceAssetId)}`;
}

function safeJobIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
