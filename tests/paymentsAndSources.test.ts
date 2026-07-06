import test from "node:test";
import assert from "node:assert/strict";
import { PlategaClient, decodePaymentPayload, encodePaymentPayload, normalizePlategaCallback } from "../packages/payments/src/index.js";
import { detectSocialPlatform } from "../packages/media-source/src/urlDetection.js";

test("payment payload is round-trippable", () => {
  const payload = { packageId: "start", userId: "user-1", nonce: "nonce-1" };
  assert.deepEqual(decodePaymentPayload(encodePaymentPayload(payload)), payload);
});

test("platega client sends merchant auth headers and RUB transaction request", async () => {
  const calls: Array<{ input: string | URL; init?: RequestInit }> = [];
  const fetcher = async (input: string | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({
      transactionId: "tx-1",
      status: "PENDING",
      url: "https://pay.example/tx-1"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const client = new PlategaClient({ baseUrl: "https://platega.test/api/", merchantId: "merchant-1", secret: "secret-1" });
  globalThis.fetch = fetcher as typeof fetch;

  const transaction = await client.createTransaction({
    amountRub: 199,
    description: "Старт",
    returnUrl: "https://bot.example/success",
    failedUrl: "https://bot.example/failed",
    payload: encodePaymentPayload({ packageId: "start", userId: "user-1", nonce: "nonce-1" }),
    metadata: { userId: "user-1" }
  });

  assert.equal(String(calls[0]?.input), "https://platega.test/api/v2/transaction/process");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(calls[0]?.init?.headers, {
    "X-MerchantId": "merchant-1",
    "X-Secret": "secret-1",
    "Content-Type": "application/json"
  });
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    paymentDetails: { amount: 199, currency: "RUB" },
    description: "Старт",
    return: "https://bot.example/success",
    failedUrl: "https://bot.example/failed",
    payload: encodePaymentPayload({ packageId: "start", userId: "user-1", nonce: "nonce-1" }),
    metadata: { userId: "user-1" }
  });
  assert.equal(transaction.status, "PENDING");
  assert.equal(transaction.url, "https://pay.example/tx-1");
});

test("platega client reads transaction status endpoint", async () => {
  const calls: Array<{ input: string | URL; init?: RequestInit }> = [];
  const client = new PlategaClient({ baseUrl: "https://platega.test/api", merchantId: "merchant-1", secret: "secret-1" });
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ id: "tx/1", status: "CONFIRMED", amount: 199, currency: "RUB" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

  const transaction = await client.getTransaction("tx/1");

  assert.equal(String(calls[0]?.input), "https://platega.test/api/transaction/tx%2F1");
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(transaction.id, "tx/1");
  assert.equal(transaction.status, "CONFIRMED");
});

test("platega callback normalization keeps payload compatible", () => {
  const payload = encodePaymentPayload({ packageId: "pro", userId: "user-2", nonce: "nonce-2" });
  const callback = normalizePlategaCallback({
    id: "tx-2",
    status: "CONFIRMED",
    amount: 499,
    currency: "RUB"
  });

  assert.equal(callback.id, "tx-2");
  assert.equal(callback.status, "CONFIRMED");
  assert.equal(callback.amount, 499);
  assert.deepEqual(decodePaymentPayload(payload), { packageId: "pro", userId: "user-2", nonce: "nonce-2" });
});

test("social source detection routes common video links", () => {
  assert.equal(detectSocialPlatform("https://youtu.be/video-id"), "youtube");
  assert.equal(detectSocialPlatform("https://www.youtube.com/watch?v=abc"), "youtube");
  assert.equal(detectSocialPlatform("https://www.tiktok.com/@user/video/1"), "tiktok");
  assert.equal(detectSocialPlatform("https://www.instagram.com/reel/abc"), "instagram");
  assert.equal(detectSocialPlatform("https://example.com/post"), "unknown");
});
