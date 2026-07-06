import { BILLING_PERIOD_DAYS, getPlanConfig, type PaidPlan } from "@covers/domain";
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";

type SubscriptionDb = DbClient | Prisma.TransactionClient;

export type BillingAccess =
  | {
      kind: "subscription";
      subscriptionId: string;
      plan: PaidPlan;
      remainingCredits: number | null;
      monthlyCreditLimit: number | null;
      avatarLimit: number | null;
      queuePriority: number;
      currentPeriodEnd: Date;
    }
  | {
      kind: "trial";
      remainingCredits: number;
      monthlyCreditLimit: number;
      avatarLimit: number;
      queuePriority: number;
      currentPeriodEnd: null;
    };

export async function getBillingAccess(db: SubscriptionDb, userId: string, now = new Date()): Promise<BillingAccess> {
  await expireOldSubscriptions(db, userId, now);
  const subscription = await activeSubscription(db, userId, now);
  if (subscription) {
    const config = getPlanConfig(subscription.plan);
    const remainingCredits =
      subscription.monthlyCreditLimit === null
        ? null
        : Math.max(0, subscription.monthlyCreditLimit - subscription.usedCredits);
    return {
      kind: "subscription",
      subscriptionId: subscription.id,
      plan: subscription.plan,
      remainingCredits,
      monthlyCreditLimit: subscription.monthlyCreditLimit,
      avatarLimit: subscription.avatarLimit,
      queuePriority: config.queuePriority,
      currentPeriodEnd: subscription.currentPeriodEnd
    };
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    kind: "trial",
    remainingCredits: user.balance,
    monthlyCreditLimit: user.balance,
    avatarLimit: 1,
    queuePriority: 50,
    currentPeriodEnd: null
  };
}

export async function activateSubscriptionInTransaction(
  db: Prisma.TransactionClient,
  input: { userId: string; plan: PaidPlan; sourcePaymentId?: string; now?: Date }
) {
  const now = input.now ?? new Date();
  const config = getPlanConfig(input.plan);
  await db.userSubscription.updateMany({
    where: { userId: input.userId, status: "ACTIVE" },
    data: { status: "EXPIRED" }
  });

  return db.userSubscription.create({
    data: {
      userId: input.userId,
      plan: input.plan,
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, BILLING_PERIOD_DAYS),
      monthlyCreditLimit: config.monthlyCredits,
      avatarLimit: config.avatarLimit,
      sourcePaymentId: input.sourcePaymentId
    }
  });
}

export async function cancelSubscriptionsForPaymentInTransaction(
  db: Prisma.TransactionClient,
  input: { userId: string; sourcePaymentId: string }
) {
  return db.userSubscription.updateMany({
    where: {
      userId: input.userId,
      sourcePaymentId: input.sourcePaymentId,
      status: "ACTIVE"
    },
    data: { status: "CANCELED" }
  });
}

export async function listActiveSubscriptions(db: DbClient) {
  return db.userSubscription.findMany({
    include: { user: true, sourcePayment: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

async function activeSubscription(db: SubscriptionDb, userId: string, now: Date) {
  return db.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodStart: { lte: now },
      currentPeriodEnd: { gt: now }
    },
    orderBy: { currentPeriodEnd: "desc" }
  });
}

async function expireOldSubscriptions(db: SubscriptionDb, userId: string, now: Date) {
  await db.userSubscription.updateMany({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { lte: now }
    },
    data: { status: "EXPIRED" }
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
