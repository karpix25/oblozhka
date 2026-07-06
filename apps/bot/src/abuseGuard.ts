import {
  FIXED_WINDOW_REDIS_SCRIPT,
  fixedWindowDecision,
  parsePositiveInteger,
  parseRateLimitFailureMode,
  retryAfterSeconds,
  type RateLimitConfig,
  type RateLimitFailureMode
} from "@covers/domain";
import { Redis, type RedisOptions } from "ioredis";
import type { BotContext } from "./session.js";

const DEFAULT_LIMIT: RateLimitConfig = { max: 6, windowMs: 60_000 };
const DEFAULT_MESSAGE = "Слишком много запросов подряд. Подождите {seconds} сек. и попробуйте ещё раз.";
const DEFAULT_REDIS_TIMEOUT_MS = 1000;

export type BotAbuseScope = "asset-upload" | "cover-generation" | "hook-generation" | "source-submit";

export type BotAbuseGuard = {
  consume: (ctx: BotContext, scope: BotAbuseScope) => Promise<boolean>;
  close: () => void;
};

type BotAbuseGuardConfig = {
  limit: RateLimitConfig;
  failureMode: RateLimitFailureMode;
  messageTemplate: string;
};

export function createBotAbuseGuard(env: NodeJS.ProcessEnv = process.env): BotAbuseGuard {
  const config = readBotAbuseGuardConfig(env);
  const client = new Redis(redisConnectionOptions(env));
  client.on("error", () => undefined);

  return {
    consume: async (ctx, scope) => consumeBotAction(client, config, ctx, scope),
    close: () => client.disconnect()
  };
}

export function readBotAbuseGuardConfig(env: NodeJS.ProcessEnv = process.env): BotAbuseGuardConfig {
  return {
    limit: {
      max: parsePositiveInteger(env.BOT_ABUSE_GUARD_MAX, DEFAULT_LIMIT.max),
      windowMs: parsePositiveInteger(env.BOT_ABUSE_GUARD_WINDOW_MS, DEFAULT_LIMIT.windowMs)
    },
    failureMode: parseRateLimitFailureMode(env.BOT_ABUSE_GUARD_REDIS_FAILURE_MODE),
    messageTemplate: env.BOT_ABUSE_GUARD_MESSAGE?.trim() || DEFAULT_MESSAGE
  };
}

async function consumeBotAction(
  client: Redis,
  config: BotAbuseGuardConfig,
  ctx: BotContext,
  scope: BotAbuseScope
) {
  const identity = botRateLimitIdentity(ctx);
  if (!identity) {
    return true;
  }

  try {
    const counter = await incrementFixedWindow(client, botRateLimitKey(scope, identity), config.limit.windowMs);
    const decision = fixedWindowDecision(counter.count, counter.ttlMs, config.limit);
    if (decision.allowed) {
      return true;
    }

    await notifyRateLimited(ctx, rateLimitMessage(config.messageTemplate, decision.retryAfterMs));
    return false;
  } catch (error) {
    console.warn("Bot abuse guard unavailable.", error);
    if (config.failureMode === "fail-closed") {
      await notifyRateLimited(ctx, "Сервис перегружен. Попробуйте ещё раз чуть позже.");
      return false;
    }
    return true;
  }
}

async function incrementFixedWindow(client: Redis, key: string, windowMs: number) {
  const result = await client.eval(FIXED_WINDOW_REDIS_SCRIPT, 1, key, String(windowMs));
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Unexpected Redis abuse guard response.");
  }

  return {
    count: Number(result[0]),
    ttlMs: Number(result[1])
  };
}

async function notifyRateLimited(ctx: BotContext, message: string) {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    return;
  }
  await ctx.reply(message);
}

function rateLimitMessage(template: string, retryAfterMs: number) {
  return template.replace("{seconds}", String(retryAfterSeconds(retryAfterMs)));
}

function botRateLimitIdentity(ctx: BotContext) {
  if (ctx.from?.id) {
    return `user:${ctx.from.id}`;
  }
  if (ctx.chat?.id) {
    return `chat:${ctx.chat.id}`;
  }
  return null;
}

function botRateLimitKey(scope: BotAbuseScope, identity: string) {
  return `covers:bot-abuse:${scope}:${safeKeyPart(identity)}`;
}

function redisConnectionOptions(env: NodeJS.ProcessEnv): RedisOptions {
  const redisUrl = new URL(env.REDIS_URL ?? "redis://localhost:6379");
  const timeoutMs = parsePositiveInteger(env.BOT_ABUSE_GUARD_REDIS_TIMEOUT_MS, DEFAULT_REDIS_TIMEOUT_MS);
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

function safeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 120);
}
