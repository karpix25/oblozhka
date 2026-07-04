import { applyLedgerEntry, type LedgerReason } from "@covers/domain";
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";
import { getBillingAccess } from "./subscriptions.js";

export type CreditMutation = {
  userId: string;
  amount: number;
  reason: LedgerReason;
  referenceId?: string;
  note?: string;
};

type CreditDb = DbClient | Prisma.TransactionClient;

export async function mutateCreditsInTransaction(db: CreditDb, input: CreditMutation) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: input.userId }
  });
  const nextBalance = applyLedgerEntry({
    currentBalance: user.balance,
    amount: input.amount,
    reason: input.reason
  });

  const ledgerEntry = await db.creditLedgerEntry.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      reason: input.reason,
      referenceId: input.referenceId,
      note: input.note
    }
  });

  const updatedUser = await db.user.update({
    where: { id: input.userId },
    data: { balance: nextBalance }
  });

  return { user: updatedUser, ledgerEntry };
}

export async function mutateCredits(db: DbClient, input: CreditMutation) {
  return db.$transaction((tx) => mutateCreditsInTransaction(tx, input));
}

export async function debitGenerationCreditInTransaction(
  db: Prisma.TransactionClient,
  input: { userId: string; amount: number; referenceId: string; note: string }
) {
  const access = await getBillingAccess(db, input.userId);
  if (access.kind === "subscription") {
    if (access.remainingCredits !== null && access.remainingCredits < input.amount) {
      throw new Error("Insufficient credits.");
    }

    if (access.monthlyCreditLimit !== null) {
      await db.userSubscription.update({
        where: { id: access.subscriptionId },
        data: { usedCredits: { increment: input.amount } }
      });
    }

    const ledgerEntry = await db.creditLedgerEntry.create({
      data: {
        userId: input.userId,
        amount: -input.amount,
        reason: "GENERATION_DEBIT",
        referenceId: input.referenceId,
        note: input.note
      }
    });

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
        await db.userSubscription.update({
          where: { id: input.chargedSubscriptionId },
          data: { usedCredits: { decrement: refundAmount } }
        });
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
