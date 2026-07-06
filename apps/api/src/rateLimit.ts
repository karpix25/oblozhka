import {
  FIXED_WINDOW_REDIS_SCRIPT,
  fixedWindowDecision,
  parsePositiveInteger,
  parseRateLimitFailureMode,
  retryAfterSeconds,
  type RateLimitConfig,
  type RateLimitFailureMode
} from "@covers/domain";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Redis } from "ioredis";
import { redisConnectionOptions } from "./routes/ops/redis.js";

const DEFAULT_PUBLIC_LIMIT: RateLimitConfig = { max: 120, windowMs: 60_000 };
const DEFAULT_ADMIN_LIMIT: RateLimitConfig = { max: 600, windowMs: 60_000 };
const EXCLUDED_PATHS = new Set(["/health"]);
const ADMIN_PATH_PREFIXES = ["/admin", "/queues", "/ops"] as const;

type ApiRateLimitPolicy = "public" | "admin";

type ApiRateLimitConfig = {
  public: RateLimitConfig;
  admin: RateLimitConfig;
  failureMode: RateLimitFailureMode;
};

type CounterResult = {
  count: number;
  ttlMs: number;
};

export async function registerApiRateLimit(app: FastifyInstance) {
  const config = readApiRateLimitConfig();
  const client = new Redis(redisConnectionOptions());
  client.on("error", () => undefined);

  app.addHook("onRequest", async (request, reply) => {
    const path = requestPath(request);
    if (EXCLUDED_PATHS.has(path)) {
      return;
    }

    return enforceApiRateLimit({ client, config, path, request, reply });
  });

  app.addHook("onClose", async () => {
    client.disconnect();
  });
}

export function readApiRateLimitConfig(env: NodeJS.ProcessEnv = process.env): ApiRateLimitConfig {
  return {
    public: {
      max: parsePositiveInteger(env.API_RATE_LIMIT_PUBLIC_MAX, DEFAULT_PUBLIC_LIMIT.max),
      windowMs: parsePositiveInteger(env.API_RATE_LIMIT_PUBLIC_WINDOW_MS, DEFAULT_PUBLIC_LIMIT.windowMs)
    },
    admin: {
      max: parsePositiveInteger(env.API_RATE_LIMIT_ADMIN_MAX, DEFAULT_ADMIN_LIMIT.max),
      windowMs: parsePositiveInteger(env.API_RATE_LIMIT_ADMIN_WINDOW_MS, DEFAULT_ADMIN_LIMIT.windowMs)
    },
    failureMode: parseRateLimitFailureMode(env.API_RATE_LIMIT_REDIS_FAILURE_MODE)
  };
}

export function classifyApiRateLimitPath(path: string): ApiRateLimitPolicy {
  return ADMIN_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    ? "admin"
    : "public";
}

async function enforceApiRateLimit(input: {
  client: Redis;
  config: ApiRateLimitConfig;
  path: string;
  request: FastifyRequest;
  reply: FastifyReply;
}) {
  const policy = classifyApiRateLimitPath(input.path);
  const limit = input.config[policy];
  const key = apiRateLimitKey(policy, input.request.ip);

  try {
    const counter = await incrementFixedWindow(input.client, key, limit.windowMs);
    const decision = fixedWindowDecision(counter.count, counter.ttlMs, limit);
    setRateLimitHeaders(input.reply, decision.limit, decision.remaining, decision.resetAfterMs);

    if (!decision.allowed) {
      return input.reply
        .code(429)
        .header("Retry-After", retryAfterSeconds(decision.retryAfterMs))
        .send({ error: "rate_limit_exceeded", retryAfterSeconds: retryAfterSeconds(decision.retryAfterMs) });
    }
  } catch (error) {
    input.request.log.warn({ error, policy }, "API rate limiter unavailable.");
    if (input.config.failureMode === "fail-closed") {
      return input.reply.code(503).send({ error: "rate_limiter_unavailable" });
    }
  }
}

async function incrementFixedWindow(client: Redis, key: string, windowMs: number): Promise<CounterResult> {
  const result = await client.eval(FIXED_WINDOW_REDIS_SCRIPT, 1, key, String(windowMs));
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Unexpected Redis rate-limit response.");
  }

  return {
    count: Number(result[0]),
    ttlMs: Number(result[1])
  };
}

function setRateLimitHeaders(reply: FastifyReply, limit: number, remaining: number, resetAfterMs: number) {
  reply
    .header("X-RateLimit-Limit", limit)
    .header("X-RateLimit-Remaining", remaining)
    .header("X-RateLimit-Reset-Seconds", retryAfterSeconds(resetAfterMs));
}

function apiRateLimitKey(policy: ApiRateLimitPolicy, ip: string) {
  return `covers:api-rate-limit:${policy}:${safeKeyPart(ip)}`;
}

function requestPath(request: FastifyRequest) {
  return request.url.split("?")[0] || "/";
}

function safeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 120);
}
