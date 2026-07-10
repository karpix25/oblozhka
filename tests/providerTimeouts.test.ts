import test from "node:test";
import assert from "node:assert/strict";
import { OpenRouterPromptPlanner } from "../packages/generation-ai/src/openrouter.js";
import { fetchTextWithTimeout } from "../packages/media-source/src/fetchWithTimeout.js";
import { PlategaClient } from "../packages/payments/src/platega.js";

test("openrouter retries retryable responses before parsing a prompt plan", async () => {
  let calls = 0;

  await withFetch(async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("temporary outage", { status: 500 });
    }
    return new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              referenceAnalysis: "Uses the supplied composition.",
              prompt: "Create a high-converting YouTube thumbnail about a concrete workflow mistake. Large readable Russian cover text: \"Ошибка в запуске\". Bold focal subject, clean background, strong contrast, no watermarks."
            })
          }
        }
      ]
    }), { status: 200 });
  }, async () => {
    const planner = new OpenRouterPromptPlanner({ apiKey: "test-key", model: "test-model", timeoutMs: 1000 });
    const plan = await planner.plan({
      wizard: {
        format: "YOUTUBE",
        referenceMode: "NONE",
        topic: "workflow launch mistake",
        niche: "automation",
        hookText: "Ошибка в запуске",
        style: "clean contrast"
      },
      formatDescription: "YouTube cover",
      aspectRatio: "16:9"
    });

    assert.equal(calls, 2);
    assert.equal(plan.model, "test-model");
  });
});

test("openrouter hook generation falls back after provider failures", async () => {
  let calls = 0;

  await withFetch(async () => {
    calls += 1;
    return new Response("temporary outage", { status: 503 });
  }, async () => {
    const planner = new OpenRouterPromptPlanner({ apiKey: "test-key", model: "test-model", timeoutMs: 1000 });
    const hooks = await planner.generateHooks({
      transcript: "Видео о запуске продукта и главной ошибке в рекламе.",
      platform: "YOUTUBE",
      theme: "запуск продукта"
    });

    assert.equal(calls, 2);
    assert.equal(hooks.length, 5);
    assert.match(hooks[0]?.text ?? "", /ЗАПУСК|ПРОДУКТ/);
  });
});

test("media-source timeout wrapper aborts hanging fetches", async () => {
  let aborted = false;

  await withFetch((_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
    }), async () => {
      await assert.rejects(
        fetchTextWithTimeout("https://media.example/transcript", {}, {
          description: "Media provider",
          timeoutMs: 5,
          attempts: 1
        }),
        /Media provider timed out after 5ms/
      );
    });

  assert.equal(aborted, true);
});

test("platega status checks time out instead of waiting forever", async () => {
  await withFetch((_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    }), async () => {
      const client = new PlategaClient({
        baseUrl: "https://platega.test/api",
        merchantId: "merchant-1",
        secret: "secret-1",
        timeoutMs: 5
      });

      await assert.rejects(client.getTransaction("tx-1"), /Platega status check timed out after 5ms/);
    });
});

async function withFetch<T>(fetcher: typeof fetch, action: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
