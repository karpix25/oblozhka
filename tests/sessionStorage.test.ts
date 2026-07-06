import test from "node:test";
import assert from "node:assert/strict";
import { createRedisSessionStorage } from "../apps/bot/src/sessionStorage.js";

class FakeRedisClient {
  private readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
  }

  async del(key: string) {
    this.values.delete(key);
  }

  async exists(key: string) {
    return this.values.has(key) ? 1 : 0;
  }
}

test("redis session storage stores JSON values under a prefixed key", async () => {
  const client = new FakeRedisClient();
  const storage = createRedisSessionStorage<{ step: string; draft?: { topic: string } }>(client, "test:");

  assert.equal(await storage.read("chat-1"), undefined);
  assert.equal(await storage.has?.("chat-1"), false);

  await storage.write("chat-1", { step: "topic", draft: { topic: "launch" } });

  assert.equal(await client.get("chat-1"), null);
  assert.deepEqual(await storage.read("chat-1"), { step: "topic", draft: { topic: "launch" } });
  assert.equal(await storage.has?.("chat-1"), true);
});

test("redis session storage deletes sessions", async () => {
  const client = new FakeRedisClient();
  const storage = createRedisSessionStorage<{ step: string }>(client, "test:");

  await storage.write("chat-1", { step: "idle" });
  await storage.delete("chat-1");

  assert.equal(await storage.read("chat-1"), undefined);
  assert.equal(await storage.has?.("chat-1"), false);
});
