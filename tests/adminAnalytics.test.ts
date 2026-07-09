import test from "node:test";
import assert from "node:assert/strict";
import { getAdminAnalyticsSummary, upsertTelegramUser, type DbClient } from "../packages/db/src/index.js";

test("admin analytics summary counts users, revenue, generations and active plans", async () => {
  const now = new Date("2026-07-09T15:30:00.000Z");
  const db = createAnalyticsDb(now);

  const summary = await getAdminAnalyticsSummary(db as unknown as DbClient, { now });

  assert.deepEqual(summary.users, {
    total: 4,
    new: { today: 1, last7Days: 2, last30Days: 3 },
    active: { today: 1, last7Days: 2, last30Days: 3 }
  });
  assert.deepEqual(summary.generations, {
    total: 4,
    byStatus: { QUEUED: 1, PROCESSING: 1, SUCCEEDED: 1, FAILED: 1 }
  });
  assert.deepEqual(summary.payments, {
    successfulCount: 2,
    revenueRub: 1500,
    averageCheckRub: 750
  });
  assert.deepEqual(summary.subscriptions.activeByPlan, {
    START: 1,
    PRO: 1,
    BUSINESS: 0
  });
});

test("upsertTelegramUser refreshes lastSeenAt on create and update", async () => {
  let upsertArgs: { create: { lastSeenAt?: Date }; update: { lastSeenAt?: Date } } | undefined;
  const db = {
    user: {
      upsert: async (args: typeof upsertArgs) => {
        upsertArgs = args;
        return args;
      }
    }
  };

  await upsertTelegramUser(db as unknown as DbClient, {
    telegramId: 1001,
    username: "user",
    firstName: "Test",
    languageCode: "ru"
  });

  assert.ok(upsertArgs?.create.lastSeenAt instanceof Date);
  assert.ok(upsertArgs?.update.lastSeenAt instanceof Date);
  assert.equal(upsertArgs.create.lastSeenAt?.getTime(), upsertArgs.update.lastSeenAt?.getTime());
});

function createAnalyticsDb(now: Date) {
  const users = [
    { createdAt: new Date("2026-07-09T10:00:00.000Z"), lastSeenAt: new Date("2026-07-09T11:00:00.000Z") },
    { createdAt: new Date("2026-07-05T10:00:00.000Z"), lastSeenAt: new Date("2026-07-05T11:00:00.000Z") },
    { createdAt: new Date("2026-06-20T10:00:00.000Z"), lastSeenAt: new Date("2026-06-20T11:00:00.000Z") },
    { createdAt: new Date("2026-05-20T10:00:00.000Z"), lastSeenAt: null }
  ];
  const generations = ["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED"];
  const payments = [
    { status: "SUCCEEDED", amountRub: 500 },
    { status: "SUCCEEDED", amountRub: 1000 },
    { status: "FAILED", amountRub: 700 }
  ];
  const subscriptions = [
    { plan: "START", status: "ACTIVE", currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z") },
    { plan: "PRO", status: "ACTIVE", currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z") },
    { plan: "BUSINESS", status: "EXPIRED", currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z") },
    { plan: "BUSINESS", status: "ACTIVE", currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z") }
  ];

  return {
    user: {
      count: async (args?: { where?: Record<string, { gte: Date }> }) => {
        const where = args?.where;
        if (!where) {
          return users.length;
        }
        const [field, filter] = Object.entries(where)[0];
        return users.filter((user) => {
          const value = user[field as "createdAt" | "lastSeenAt"];
          return value instanceof Date && value >= filter.gte;
        }).length;
      }
    },
    generation: {
      groupBy: async () => groupByCount(generations)
    },
    payment: {
      aggregate: async () => {
        const successful = payments.filter((payment) => payment.status === "SUCCEEDED");
        return {
          _count: { _all: successful.length },
          _sum: { amountRub: successful.reduce((total, payment) => total + payment.amountRub, 0) }
        };
      }
    },
    userSubscription: {
      groupBy: async () =>
        groupByCount(
          subscriptions
            .filter((subscription) => subscription.status === "ACTIVE" && subscription.currentPeriodEnd >= now)
            .map((subscription) => subscription.plan),
          "plan"
        )
    }
  };
}

function groupByCount(values: string[], key = "status") {
  return [...new Set(values)].map((value) => ({
    [key]: value,
    _count: { _all: values.filter((item) => item === value).length }
  }));
}
