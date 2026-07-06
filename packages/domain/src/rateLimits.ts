export type RateLimitFailureMode = "fail-open" | "fail-closed";

export type RateLimitConfig = {
  max: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterMs: number;
  resetAfterMs: number;
};

export const FIXED_WINDOW_REDIS_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export function fixedWindowDecision(
  count: number,
  ttlMs: number,
  config: RateLimitConfig
): RateLimitDecision {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  const safeTtlMs = Number.isFinite(ttlMs) ? Math.max(0, Math.trunc(ttlMs)) : config.windowMs;
  const allowed = safeCount <= config.max;

  return {
    allowed,
    count: safeCount,
    limit: config.max,
    remaining: Math.max(0, config.max - safeCount),
    retryAfterMs: allowed ? 0 : safeTtlMs,
    resetAfterMs: safeTtlMs
  };
}

export function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseRateLimitFailureMode(
  value: string | undefined,
  fallback: RateLimitFailureMode = "fail-open"
): RateLimitFailureMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "fail-open" || normalized === "fail-closed") {
    return normalized;
  }
  return fallback;
}

export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}
