import { assertPositiveCredits, type LedgerReason } from "@covers/domain";
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";
import { getBillingAccess, type BillingAccess } from "./subscriptions.js";

export type CreditMutation = {
  userId: string;
  amount: number;
  reason: LedgerReason;
  referenceId?: string;
  note?: string;
};

type CreditDb = DbClient | Prisma.TransactionClient;

export async function mutateCreditsInTransaction(db: CreditDb, input: CreditMutation) {
  assertLedgerAmount(input.amount);

  if (input.amount < 0) {
    return debitTrialCredits(db, input);
  }

  const updatedUser = await db.user.update({
    where: { id: input.userId },
    data: { balance: { increment: input.amount } }
  });
  const ledgerEntry = await createLedgerEntry(db, input);

  return { user: updatedUser, ledgerEntry };
}

export async function mutateCredits(db: DbClient, input: CreditMutation) {
  return db.$transaction((tx) => mutateCreditsInTransaction(tx, input));
}

export async function reversePurchasedCreditsInTransaction(
  db: Prisma.TransactionClient,
  input: { userId: string; amount: number; referenceId: string; note: string }
) {
  assertPositiveCredits(input.amount);

  const user = await db.user.findUniqueOrThrow({
    where: { id: input.userId }
  });
  const balanceCreditsToRemove = Math.min(Math.max(0, user.balance), input.amount);
  if (balanceCreditsToRemove > 0) {
    const result = await db.user.updateMany({
      where: {
        id: input.userId,
        balance: { gte: balanceCreditsToRemove }
      },
      data: { balance: { decrement: balanceCreditsToRemove } }
    });

    if (result.count !== 1) {
      throw new Error("Purchased credits were already spent.");
    }
  }

  return db.creditLedgerEntry.create({
    data: {
      userId: input.userId,
      amount: -input.amount,
      reason: "MANUAL_ADJUSTMENT",
      referenceId: input.referenceId,
      note: input.note
    }
  });
}

export async function debitGenerationCreditInTransaction(
  db: Prisma.TransactionClient,
  input: { userId: string; amount: number; referenceId: string; note: string }
) {
  assertPositiveCredits(input.amount);

  const access = await getBillingAccess(db, input.userId);
  if (access.kind === "superadmin") {
    return { access, ledgerEntry: null };
  }
  if (access.kind === "subscription") {
    const ledgerEntry = await debitSubscriptionCredits(db, input, access);

    return { access, ledgerEntry };
  }

  const { ledgerEntry } = await mutateCreditsInTransaction(db, {
    userId: input.userId,
    amount: -input.amount,
    reason: "GENERATION_DEBIT",
    referenceId: input.referenceId,
    note: input.note
  });

  return { access, ledgerEntry };
}

async function debitTrialCredits(db: CreditDb, input: CreditMutation) {
  const debitAmount = -input.amount;
  const result = await db.user.updateMany({
    where: {
      id: input.userId,
      balance: { gte: debitAmount }
    },
    data: { balance: { decrement: debitAmount } }
  });

  if (result.count !== 1) {
    throw new Error("Insufficient credits.");
  }

  const ledgerEntry = await createLedgerEntry(db, input);
  const updatedUser = await db.user.findUniqueOrThrow({
    where: { id: input.userId }
  });

  return { user: updatedUser, ledgerEntry };
}

async function debitSubscriptionCredits(
  db: Prisma.TransactionClient,
  input: { userId: string; amount: number; referenceId: string; note: string },
  access: Extract<BillingAccess, { kind: "subscription" }>
) {
  if (access.monthlyCreditLimit !== null) {
    const maxUsedCreditsBeforeDebit = access.monthlyCreditLimit - input.amount;
    if (maxUsedCreditsBeforeDebit < 0) {
      throw new Error("Insufficient credits.");
    }

    const result = await db.userSubscription.updateMany({
      where: {
        id: access.subscriptionId,
        usedCredits: { lte: maxUsedCreditsBeforeDebit }
      },
      data: { usedCredits: { increment: input.amount } }
    });

    if (result.count !== 1) {
      throw new Error("Insufficient credits.");
    }
  }

  return createLedgerEntry(db, {
    userId: input.userId,
    amount: -input.amount,
    reason: "GENERATION_DEBIT",
    referenceId: input.referenceId,
    note: input.note
  });
}

async function createLedgerEntry(db: CreditDb, input: CreditMutation) {
  return db.creditLedgerEntry.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      reason: input.reason,
      referenceId: input.referenceId,
      note: input.note
    }
  });
}

function assertLedgerAmount(amount: number) {
  assertPositiveCredits(Math.abs(amount));
}

export async function refundGenerationCreditInTransaction(
  db: Prisma.TransactionClient,
  input: { userId: string; amount: number; referenceId: string; chargedSubscriptionId?: string | null; note: string }
) {
  if (input.chargedSubscriptionId) {
    const subscription = await db.userSubscription.findUnique({
      where: { id: input.chargedSubscriptionId }
    });
    if (subscription && subscription.monthlyCreditLimit !== null) {
      const refundAmount = Math.min(subscription.usedCredits, input.amount);
      if (refundAmount > 0) {
        const result = await db.userSubscription.updateMany({
          where: {
            id: input.chargedSubscriptionId,
            usedCredits: { gte: refundAmount }
          },
          data: { usedCredits: { decrement: refundAmount } }
        });

        if (result.count !== 1) {
          throw new Error("Refund credits were already restored.");
        }
      }
    }

    await db.creditLedgerEntry.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        reason: "GENERATION_REFUND",
        referenceId: input.referenceId,
        note: input.note
      }
    });
    return;
  }

  await mutateCreditsInTransaction(db, {
    userId: input.userId,
    amount: input.amount,
    reason: "GENERATION_REFUND",
    referenceId: input.referenceId,
    note: input.note
  });
}

export async function listLedger(db: DbClient, userId: string) {
  return db.creditLedgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}
