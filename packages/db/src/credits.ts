import { applyLedgerEntry, type LedgerReason } from "@covers/domain";
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";

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

export async function listLedger(db: DbClient, userId: string) {
  return db.creditLedgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}
