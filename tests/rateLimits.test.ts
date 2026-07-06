import test from "node:test";
import assert from "node:assert/strict";
import {
  fixedWindowDecision,
  parsePositiveInteger,
  parseRateLimitFailureMode,
  retryAfterSeconds
} from "../packages/domain/src/rateLimits.js";
import { classifyApiRateLimitPath, readApiRateLimitConfig } from "../apps/api/src/rateLimit.js";
import { readBotAbuseGuardConfig } from "../apps/bot/src/abuseGuard.js";

test("fixed window decisions allow requests through the configured maximum", () => {
  assert.deepEqual(fixedWindowDecision(3, 25_000, { max: 3, windowMs: 60_000 }), {
    allowed: true,
    count: 3,
    limit: 3,
    remaining: 0,
    retryAfterMs: 0,
    resetAfterMs: 25_000
  });

  assert.deepEqual(fixedWindowDecision(4, 25_000, { max: 3, windowMs: 60_000 }), {
    allowed: false,
    count: 4,
    limit: 3,
    remaining: 0,
    retryAfterMs: 25_000,
    resetAfterMs: 25_000
  });

  assert.deepEqual(fixedWindowDecision(Number.NaN, Number.NaN, { max: 3, windowMs: 60_000 }), {
    allowed: true,
    count: 0,
    limit: 3,
    remaining: 3,
    retryAfterMs: 0,
    resetAfterMs: 60_000
  });
});

test("rate limit env parsing keeps safe defaults for invalid values", () => {
  assert.equal(parsePositiveInteger("10", 5), 10);
  assert.equal(parsePositiveInteger("0", 5), 5);
  assert.equal(parsePositiveInteger("bad", 5), 5);
  assert.equal(parseRateLimitFailureMode("fail-closed"), "fail-closed");
  assert.equal(parseRateLimitFailureMode("unknown"), "fail-open");
  assert.equal(retryAfterSeconds(1001), 2);
});

test("API rate limit config and route classification are explicit", () => {
  const config = readApiRateLimitConfig({
    API_RATE_LIMIT_PUBLIC_MAX: "80",
    API_RATE_LIMIT_PUBLIC_WINDOW_MS: "30000",
    API_RATE_LIMIT_ADMIN_MAX: "400",
    API_RATE_LIMIT_ADMIN_WINDOW_MS: "60000",
    API_RATE_LIMIT_REDIS_FAILURE_MODE: "fail-closed"
  });

  assert.deepEqual(config.public, { max: 80, windowMs: 30_000 });
  assert.deepEqual(config.admin, { max: 400, windowMs: 60_000 });
  assert.equal(config.failureMode, "fail-closed");
  assert.equal(classifyApiRateLimitPath("/admin/templates"), "admin");
  assert.equal(classifyApiRateLimitPath("/queues/status"), "admin");
  assert.equal(classifyApiRateLimitPath("/ops/metrics"), "admin");
  assert.equal(classifyApiRateLimitPath("/ready"), "public");
});

test("bot abuse guard config uses env overrides without Redis", () => {
  const config = readBotAbuseGuardConfig({
    BOT_ABUSE_GUARD_MAX: "4",
    BOT_ABUSE_GUARD_WINDOW_MS: "45000",
    BOT_ABUSE_GUARD_REDIS_FAILURE_MODE: "fail-closed",
    BOT_ABUSE_GUARD_MESSAGE: "Подождите {seconds} сек."
  });

  assert.deepEqual(config.limit, { max: 4, windowMs: 45_000 });
  assert.equal(config.failureMode, "fail-closed");
  assert.equal(config.messageTemplate, "Подождите {seconds} сек.");
});
