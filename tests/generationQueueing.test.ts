import test from "node:test";
import assert from "node:assert/strict";
import { enqueueGenerationOrCompensate, GenerationEnqueueError } from "../apps/bot/src/generationQueueing.js";

test("enqueue compensation marks generation failed when queue add fails", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      enqueueGenerationOrCompensate(
        { id: "gen-1", queuePriority: 25, projectId: "project-1" },
        123,
        {
          queue: {
            add: async () => {
              throw new Error("redis down");
            }
          },
          markFailed: async (_db, id, message) => {
            calls.push(`failed:${id}:${message}`);
            return {} as never;
          },
          markProject: async (_db, projectId, status, message) => {
            calls.push(`project:${projectId}:${status}:${message}`);
            return {} as never;
          }
        }
      ),
    (error) => error instanceof GenerationEnqueueError && error.details.compensationSucceeded
  );

  assert.equal(calls.length, 2);
  assert.match(calls[0], /^failed:gen-1:Generation queue enqueue failed: redis down$/);
  assert.match(calls[1], /^project:project-1:FAILED:Generation queue enqueue failed: redis down$/);
});

test("enqueue compensation escalates when refund marking also fails", async () => {
  await assert.rejects(
    () =>
      enqueueGenerationOrCompensate(
        { id: "gen-1", queuePriority: 25 },
        123,
        {
          queue: {
            add: async () => {
              throw new Error("redis down");
            }
          },
          markFailed: async () => {
            throw new Error("db down");
          },
          markProject: async () => ({} as never)
        }
      ),
    (error) => error instanceof GenerationEnqueueError && !error.details.compensationSucceeded
  );
});
