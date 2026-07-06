import { Redis, type RedisOptions } from "ioredis";

const DEFAULT_REDIS_CHECK_TIMEOUT_MS = 1000;

export function redisConnectionOptions(): RedisOptions {
  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  const timeoutMs = redisCheckTimeoutMs();
  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined,
    connectTimeout: timeoutMs,
    commandTimeout: timeoutMs,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null
  };
}

export async function pingRedis(): Promise<void> {
  const client = new Redis(redisConnectionOptions());
  client.on("error", () => undefined);
  try {
    const result = await client.ping();
    if (result !== "PONG") {
      throw new Error(`Unexpected Redis PING response: ${result}`);
    }
  } finally {
    client.disconnect();
  }
}

function redisCheckTimeoutMs() {
  const parsed = Number(process.env.REDIS_CHECK_TIMEOUT_MS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_REDIS_CHECK_TIMEOUT_MS;
}
