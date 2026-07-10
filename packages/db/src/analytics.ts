import { PAID_PLAN_ORDER } from "@covers/domain";
import type { DbClient } from "./client.js";
import { getCjmAnalytics, type CjmAnalytics } from "./productAnalytics.js";

const GENERATION_STATUSES = ["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED"] as const;

export type AdminAnalyticsSummary = {
  generatedAt: string;
  users: {
    total: number;
    new: WindowCounts;
    active: WindowCounts;
  };
  generations: {
    total: number;
    byStatus: Record<(typeof GENERATION_STATUSES)[number], number>;
  };
  payments: {
    successfulCount: number;
    revenueRub: number;
    averageCheckRub: number;
  };
  subscriptions: {
    activeByPlan: Record<(typeof PAID_PLAN_ORDER)[number], number>;
  };
  cjm: CjmAnalytics;
};

type WindowCounts = {
  today: number;
  last7Days: number;
  last30Days: number;
};

type AnalyticsOptions = {
  now?: Date;
};

export async function getAdminAnalyticsSummary(
  db: DbClient,
  options: AnalyticsOptions = {}
): Promise<AdminAnalyticsSummary> {
  const now = options.now ?? new Date();
  const windows = getAnalyticsWindows(now);

  const [
    totalUsers,
    newUsersToday,
    newUsers7Days,
    newUsers30Days,
    activeUsersToday,
    activeUsers7Days,
    activeUsers30Days,
    generationGroups,
    paymentTotals,
    subscriptionGroups,
    cjm
  ] = await Promise.all([
    db.user.count(),
    countUsersSince(db, "createdAt", windows.today),
    countUsersSince(db, "createdAt", windows.last7Days),
    countUsersSince(db, "createdAt", windows.last30Days),
    countUsersSince(db, "lastSeenAt", windows.today),
    countUsersSince(db, "lastSeenAt", windows.last7Days),
    countUsersSince(db, "lastSeenAt", windows.last30Days),
    db.generation.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    db.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _count: { _all: true },
      _sum: { amountRub: true }
    }),
    db.userSubscription.groupBy({
      by: ["plan"],
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { gte: now }
      },
      _count: { _all: true }
    }),
    getCjmAnalytics(db, { now })
  ]);

  const successfulCount = paymentTotals._count._all;
  const revenueRub = paymentTotals._sum.amountRub ?? 0;

  return {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      new: {
        today: newUsersToday,
        last7Days: newUsers7Days,
        last30Days: newUsers30Days
      },
      active: {
        today: activeUsersToday,
        last7Days: activeUsers7Days,
        last30Days: activeUsers30Days
      }
    },
    generations: {
      total: sumGroupedCounts(generationGroups),
      byStatus: countsByKey(GENERATION_STATUSES, generationGroups)
    },
    payments: {
      successfulCount,
      revenueRub,
      averageCheckRub: successfulCount > 0 ? Math.round(revenueRub / successfulCount) : 0
    },
    subscriptions: {
      activeByPlan: countsByKey(PAID_PLAN_ORDER, subscriptionGroups)
    },
    cjm
  };
}

function getAnalyticsWindows(now: Date) {
  return {
    today: startOfDay(now),
    last7Days: daysAgo(now, 7),
    last30Days: daysAgo(now, 30)
  };
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function daysAgo(date: Date, days: number) {
  const start = new Date(date);
  start.setDate(start.getDate() - days);
  return start;
}

function countUsersSince(db: DbClient, field: "createdAt" | "lastSeenAt", since: Date) {
  return db.user.count({
    where: {
      [field]: { gte: since }
    }
  });
}

function countsByKey<const T extends readonly string[]>(
  keys: T,
  groups: Array<{ [key: string]: string | number | object }>
) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>;
  for (const group of groups) {
    const key = String(group.status ?? group.plan);
    if (key in counts) {
      counts[key as T[number]] = extractCount(group);
    }
  }
  return counts;
}

function sumGroupedCounts(groups: Array<{ _count: { _all: number } }>) {
  return groups.reduce((total, group) => total + group._count._all, 0);
}

function extractCount(group: { [key: string]: string | number | object }) {
  const count = group._count as { _all?: number } | undefined;
  return count?._all ?? 0;
}
