import assert from "node:assert/strict";
import test from "node:test";
import {
  getCjmAnalytics,
  getProductFunnel,
  listProductEvents,
  recordProductEvent,
  type DbClient,
  type ProductEventName
} from "../packages/db/src/index.js";

test("CJM analytics counts unique projects and calculates p50/p90 timings", async () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const events = [
    event("e1", "project_started", "p1", "2026-07-10T10:00:00.000Z"),
    event("e2", "project_started", "p2", "2026-07-10T10:01:00.000Z"),
    event("e3", "source_submitted", "p1", "2026-07-10T10:00:10.000Z"),
    event("e4", "platform_selected", "p1", "2026-07-10T10:00:20.000Z"),
    event("e5", "templates_shown", "p1", "2026-07-10T10:00:30.000Z"),
    event("e6", "template_selected", "p1", "2026-07-10T10:00:31.000Z"),
    event("e7", "hooks_started", "p1", "2026-07-10T10:00:31.000Z"),
    event("e8", "hooks_ready", "p1", "2026-07-10T10:00:41.000Z"),
    event("e9", "hook_selected", "p1", "2026-07-10T10:00:45.000Z"),
    event("e10", "reference_selected", "p1", "2026-07-10T10:00:50.000Z"),
    event("e11", "generation_started", "p1", "2026-07-10T10:01:00.000Z"),
    event("e12", "generation_succeeded", "p1", "2026-07-10T10:02:00.000Z")
  ];
  const generations = [
    timing("2026-07-10T10:00:00.000Z", "2026-07-10T10:00:10.000Z", "2026-07-10T10:00:30.000Z"),
    timing("2026-07-10T10:00:00.000Z", "2026-07-10T10:00:30.000Z", "2026-07-10T10:01:30.000Z")
  ];
  const db = {
    productEvent: { findMany: async () => events },
    generation: { findMany: async () => generations }
  };

  const analytics = await getCjmAnalytics(db as unknown as DbClient, { now });

  assert.equal(analytics.funnel[0].count, 2);
  assert.equal(analytics.funnel[1].count, 1);
  assert.equal(analytics.funnel[1].conversionFromPrevious, 50);
  assert.equal(analytics.funnel.at(-1)?.conversionFromStart, 50);
  assert.deepEqual(analytics.journeyDurations.sourceToTemplates, {
    sampleSize: 1,
    p50Ms: 20_000,
    p90Ms: 20_000
  });
  assert.deepEqual(analytics.generationDurations.queue, {
    sampleSize: 2,
    p50Ms: 10_000,
    p90Ms: 30_000
  });
  assert.deepEqual(analytics.generationDurations.total, {
    sampleSize: 2,
    p50Ms: 30_000,
    p90Ms: 90_000
  });
});

test("product event helpers preserve typed event data and filters", async () => {
  let createInput: unknown;
  const findInputs: unknown[] = [];
  const row = event("event-1", "template_selected", "project-1", "2026-07-10T10:00:00.000Z");
  const db = {
    productEvent: {
      create: async (args: unknown) => {
        createInput = args;
        return row;
      },
      findMany: async (args: unknown) => {
        findInputs.push(args);
        return [row];
      }
    }
  };

  await recordProductEvent(db as unknown as DbClient, {
    name: "template_selected",
    userId: "user-1",
    projectId: "project-1",
    metadata: { source: "recommended" }
  });
  const listed = await listProductEvents(db as unknown as DbClient, {
    names: ["template_selected"],
    projectId: "project-1",
    take: 10
  });
  const funnel = await getProductFunnel(db as unknown as DbClient);

  assert.equal(listed[0].name, "template_selected");
  assert.match(JSON.stringify(createInput), /recommended/);
  assert.match(JSON.stringify(findInputs[0]), /project-1/);
  assert.equal(funnel.find((step) => step.name === "template_selected")?.count, 0);
});

function event(id: string, name: ProductEventName, projectId: string, createdAt: string) {
  return {
    id,
    name,
    userId: "user-1",
    projectId,
    generationId: null,
    metadata: null,
    createdAt: new Date(createdAt)
  };
}

function timing(queuedAt: string, startedAt: string, finishedAt: string) {
  return {
    queuedAt: new Date(queuedAt),
    startedAt: new Date(startedAt),
    finishedAt: new Date(finishedAt)
  };
}
