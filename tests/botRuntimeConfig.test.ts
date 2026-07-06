import test from "node:test";
import assert from "node:assert/strict";
import { parseBotRuntimeConfig } from "../apps/bot/src/runtime.js";

test("bot runtime defaults to long polling without webhook URL", () => {
  assert.deepEqual(parseBotRuntimeConfig({}), { mode: "polling" });
  assert.deepEqual(parseBotRuntimeConfig({ BOT_WEBHOOK_URL: "  " }), { mode: "polling" });
});

test("bot runtime parses webhook config from env", () => {
  assert.deepEqual(
    parseBotRuntimeConfig({
      BOT_WEBHOOK_URL: "https://example.com/telegram/webhook",
      BOT_WEBHOOK_HOST: "127.0.0.1",
      BOT_WEBHOOK_PORT: "9090"
    }),
    {
      mode: "webhook",
      webhookUrl: "https://example.com/telegram/webhook",
      host: "127.0.0.1",
      port: 9090
    }
  );
});

test("bot runtime fills webhook listener defaults", () => {
  assert.deepEqual(
    parseBotRuntimeConfig({
      BOT_WEBHOOK_URL: "https://example.com/webhook"
    }),
    {
      mode: "webhook",
      webhookUrl: "https://example.com/webhook",
      host: "0.0.0.0",
      port: 8080
    }
  );
});

test("bot runtime rejects invalid webhook config", () => {
  assert.throws(
    () => parseBotRuntimeConfig({ BOT_WEBHOOK_URL: "not-a-url" }),
    /BOT_WEBHOOK_URL must be a valid absolute URL/
  );
  assert.throws(
    () => parseBotRuntimeConfig({ BOT_WEBHOOK_URL: "https://example.com/webhook", BOT_WEBHOOK_PORT: "0" }),
    /BOT_WEBHOOK_PORT must be an integer from 1 to 65535/
  );
});
