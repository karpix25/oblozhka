import test from "node:test";
import assert from "node:assert/strict";
import { isAdminBearerAuthorized } from "../apps/api/src/auth.js";
import { collectProductionEnvIssues, isProductionRuntime } from "../apps/api/src/env.js";
import { readAdminToken, saveToken } from "../apps/admin/src/adminToken.js";

const validProductionEnv = {
  APP_ENV: "production",
  ADMIN_TOKEN: "admin-secret",
  BOT_TOKEN: "bot-secret",
  DATABASE_URL: "postgresql://postgres:secret@postgres:5432/covers",
  REDIS_URL: "redis://redis:6379",
  PLATEGA_BASE_URL: "https://app.platega.io/",
  PLATEGA_MERCHANT_ID: "merchant-1",
  PLATEGA_SECRET: "platega-secret",
  PAYMENT_RETURN_URL: "https://t.me/karpix_oblozhka_bot",
  KIE_API_KEY: "kie-secret",
  KIE_BASE_URL: "https://api.kie.ai",
  KIE_IMAGE_MODEL: "gpt-image-2-image-to-image",
  OPENROUTER_API_KEY: "openrouter-secret",
  OPENROUTER_MODEL: "google/gemini-3.1-flash-image-preview",
  SCRAPECREATORS_API_KEY: "scrape-secret",
  SCRAPECREATORS_BASE_URL: "https://api.scrapecreators.com",
  DEEPGRAM_API_KEY: "deepgram-secret",
  DEEPGRAM_MODEL: "nova-3",
  S3_ENDPOINT: "https://s3.example.com",
  S3_REGION: "auto",
  S3_BUCKET: "covers",
  S3_ACCESS_KEY_ID: "s3-key",
  S3_SECRET_ACCESS_KEY: "s3-secret",
  S3_PUBLIC_BASE_URL: "https://cdn.example.com"
};

test("admin bearer auth accepts only the configured server token", () => {
  assert.equal(isAdminBearerAuthorized("Bearer admin-secret", "admin-secret"), true);
  assert.equal(isAdminBearerAuthorized("Bearer wrong", "admin-secret"), false);
  assert.equal(isAdminBearerAuthorized(undefined, "admin-secret"), false);
});

test("admin frontend token comes only from browser storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };

  assert.equal(readAdminToken(storage), "");
  saveToken("stored-admin-token", storage);
  assert.equal(readAdminToken(storage), "stored-admin-token");
});

test("production env validation is skipped for local app env", () => {
  assert.equal(isProductionRuntime({ APP_ENV: "local", NODE_ENV: "production" }), false);
  assert.deepEqual(collectProductionEnvIssues({ APP_ENV: "local", NODE_ENV: "production" }), []);
});

test("production env validation rejects missing and placeholder secrets", () => {
  const issues = collectProductionEnvIssues({
    ...validProductionEnv,
    ADMIN_TOKEN: "change-me",
    BOT_TOKEN: "",
    S3_BUCKET: ""
  });

  assert.ok(issues.includes("ADMIN_TOKEN must be set to a real production secret, not a placeholder."));
  assert.ok(issues.includes("BOT_TOKEN is required in production."));
  assert.ok(issues.includes("S3_BUCKET is required in production."));
});

test("production env validation accepts complete production config", () => {
  assert.equal(isProductionRuntime(validProductionEnv), true);
  assert.deepEqual(collectProductionEnvIssues(validProductionEnv), []);
});
