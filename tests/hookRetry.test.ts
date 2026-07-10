import assert from "node:assert/strict";
import test from "node:test";
import { prepareHookJob } from "../apps/bot/src/projectFlow/hookRetry.js";

test("prepareHookJob removes a terminal job before retry", async () => {
  let removed = false;
  let lookup = 0;
  const job = {
    getState: async () => "failed",
    remove: async () => {
      removed = true;
    }
  };
  const queue = {
    getJob: async () => (lookup++ === 0 ? job : null)
  };

  assert.equal(await prepareHookJob(queue, "hooks-project-1"), "ready");
  assert.equal(removed, true);
});

test("prepareHookJob keeps an active job idempotent", async () => {
  let removed = false;
  const queue = {
    getJob: async () => ({
      getState: async () => "active",
      remove: async () => {
        removed = true;
      }
    })
  };

  assert.equal(await prepareHookJob(queue, "hooks-project-1"), "already-running");
  assert.equal(removed, false);
});

test("prepareHookJob rejects when a terminal job cannot be cleared", async () => {
  const job = {
    getState: async () => "failed",
    remove: async () => undefined
  };
  const queue = { getJob: async () => job };

  await assert.rejects(() => prepareHookJob(queue, "hooks-project-1"), /still exists/);
});
