import type { StorageAdapter } from "grammy";
import { Redis } from "ioredis";
import type { BotSession } from "./session.js";

type RedisSessionClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  exists(key: string): Promise<number>;
};

export type ManagedSessionStorage = {
  storage?: StorageAdapter<BotSession>;
  close: () => Promise<void>;
};

const DEFAULT_SESSION_PREFIX = "bot:session:";

export function createRedisSessionStorage<T>(
  client: RedisSessionClient,
  prefix = DEFAULT_SESSION_PREFIX
): StorageAdapter<T> {
  return {
    async read(key) {
      const value = await client.get(sessionKey(prefix, key));
      return value === null ? undefined : JSON.parse(value) as T;
    },
    async write(key, value) {
      await client.set(sessionKey(prefix, key), JSON.stringify(value));
    },
    async delete(key) {
      await client.del(sessionKey(prefix, key));
    },
    async has(key) {
      return (await client.exists(sessionKey(prefix, key))) > 0;
    }
  };
}

export function createBotSessionStorage(): ManagedSessionStorage {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      storage: undefined,
      close: async () => undefined
    };
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null
  });
  client.on("error", (error: Error) => {
    console.error("Redis session storage error:", error);
  });

  return {
    storage: createRedisSessionStorage<BotSession>(client),
    close: () => {
      client.disconnect();
      return Promise.resolve();
    }
  };
}

function sessionKey(prefix: string, key: string) {
  return `${prefix}${key}`;
}
