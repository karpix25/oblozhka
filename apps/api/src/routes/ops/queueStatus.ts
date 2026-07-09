import { FACE_CARD_QUEUE, GENERATION_QUEUE, HOOK_QUEUE } from "@covers/domain";
import { Redis } from "ioredis";
import { createReadyRedisClient } from "./redis.js";

export const MONITORED_QUEUE_NAMES = [GENERATION_QUEUE, HOOK_QUEUE, FACE_CARD_QUEUE] as const;
const LIST_STATES = ["waiting", "active"] as const;
const ZSET_STATES = ["delayed", "failed"] as const;
const OLDEST_STATES = [...LIST_STATES, ...ZSET_STATES] as const;

type QueueState = (typeof OLDEST_STATES)[number];

export type QueueStatus = {
  name: string;
  counts: Record<QueueState, number>;
  oldestJob: {
    id: string;
    state: QueueState;
    ageMs: number;
    timestamp: string;
  } | null;
};

export async function collectQueueStatuses(now = new Date()): Promise<QueueStatus[]> {
  const client = await createReadyRedisClient();
  try {
    return await Promise.all(MONITORED_QUEUE_NAMES.map((name) => collectQueueStatus(client, name, now)));
  } finally {
    client.disconnect();
  }
}

export async function assertQueuesReady(): Promise<void> {
  await collectQueueStatuses();
}

async function collectQueueStatus(client: Redis, name: string, now: Date): Promise<QueueStatus> {
  const [counts, oldestJob] = await Promise.all([
    collectCounts(client, name),
    findOldestJob(client, name, now)
  ]);
  return { name, counts, oldestJob };
}

async function collectCounts(client: Redis, name: string): Promise<QueueStatus["counts"]> {
  const [waiting, active, delayed, failed] = await Promise.all([
    countWaitingJobs(client, name),
    client.llen(queueKey(name, "active")),
    client.zcard(queueKey(name, "delayed")),
    client.zcard(queueKey(name, "failed"))
  ]);
  return { waiting, active, delayed, failed };
}

async function countWaitingJobs(client: Redis, name: string): Promise<number> {
  const [waitCount, pausedCount] = await Promise.all([
    countListJobs(client, queueKey(name, "wait"), true),
    countListJobs(client, queueKey(name, "paused"), true)
  ]);
  return waitCount + pausedCount;
}

async function countListJobs(client: Redis, key: string, excludesMarker: boolean): Promise<number> {
  const [count, lastId] = await Promise.all([client.llen(key), client.lindex(key, -1)]);
  return excludesMarker && isBullMarker(lastId) ? Math.max(0, count - 1) : count;
}

async function findOldestJob(client: Redis, name: string, now: Date): Promise<QueueStatus["oldestJob"]> {
  const candidates = await Promise.all([
    oldestWaitingJob(client, name, now),
    oldestListJob(client, name, "active", now),
    oldestZsetJob(client, name, "delayed", now),
    oldestZsetJob(client, name, "failed", now)
  ]);
  return candidates
    .filter((job): job is NonNullable<QueueStatus["oldestJob"]> => Boolean(job))
    .sort((left, right) => right.ageMs - left.ageMs)[0] ?? null;
}

async function oldestWaitingJob(client: Redis, name: string, now: Date): Promise<QueueStatus["oldestJob"]> {
  const candidates = await Promise.all([
    oldestListJob(client, name, "waiting", now, queueKey(name, "wait")),
    oldestListJob(client, name, "waiting", now, queueKey(name, "paused"))
  ]);
  return candidates
    .filter((job): job is NonNullable<QueueStatus["oldestJob"]> => Boolean(job))
    .sort((left, right) => right.ageMs - left.ageMs)[0] ?? null;
}

async function oldestListJob(
  client: Redis,
  name: string,
  state: Extract<QueueState, "waiting" | "active">,
  now: Date,
  key = queueKey(name, state)
): Promise<QueueStatus["oldestJob"]> {
  const ids = await client.lrange(key, -2, -1);
  const jobId = ids.reverse().find((id) => id && !isBullMarker(id));
  return jobId ? oldestJobFromId(client, name, jobId, state, now) : null;
}

async function oldestZsetJob(
  client: Redis,
  name: string,
  state: Extract<QueueState, "delayed" | "failed">,
  now: Date
): Promise<QueueStatus["oldestJob"]> {
  const [jobId] = await client.zrange(queueKey(name, state), 0, 0);
  return jobId ? oldestJobFromId(client, name, jobId, state, now) : null;
}

async function oldestJobFromId(
  client: Redis,
  name: string,
  jobId: string,
  state: QueueState,
  now: Date
): Promise<QueueStatus["oldestJob"]> {
  const rawTimestamp = await client.hget(queueKey(name, jobId), "timestamp");
  const timestampMs = Number(rawTimestamp);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }
  return {
    id: jobId,
    state,
    ageMs: Math.max(0, now.getTime() - timestampMs),
    timestamp: new Date(timestampMs).toISOString()
  };
}

function queueKey(name: string, suffix: string): string {
  return `${queuePrefix()}:${name}:${suffix}`;
}

function queuePrefix(): string {
  return process.env.BULLMQ_PREFIX?.trim() || "bull";
}

function isBullMarker(id: string | null): boolean {
  return Boolean(id?.startsWith("0:"));
}
