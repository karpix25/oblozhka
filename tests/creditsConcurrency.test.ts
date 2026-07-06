import test from "node:test";
import assert from "node:assert/strict";
import {
  debitGenerationCreditInTransaction,
  mutateCreditsInTransaction,
  refundGenerationCreditInTransaction
} from "../packages/db/src/credits.js";

test("trial credit debits are atomic under parallel attempts", async () => {
  const { db, state } = createTrialDb(1);

  const results = await Promise.allSettled([
    mutateCreditsInTransaction(db, debitInput("gen_1")),
    mutateCreditsInTransaction(db, debitInput("gen_2"))
  ]);

  assertOneSuccessAndOneInsufficientCreditFailure(results);
  assert.equal(state.user.balance, 0);
  assert.equal(state.ledgerEntries.length, 1);
  assert.equal(state.ledgerEntries[0]?.amount, -1);
});

test("trial credit debit does not create a ledger entry when balance is insufficient", async () => {
  const { db, state } = createTrialDb(0);

  await assert.rejects(() => mutateCreditsInTransaction(db, debitInput("gen_1")), /Insufficient credits/);
  assert.equal(state.user.balance, 0);
  assert.equal(state.ledgerEntries.length, 0);
});

test("subscription usedCredits debits are atomic under parallel attempts", async () => {
  const { db, state } = createSubscriptionDb({ monthlyCreditLimit: 1, usedCredits: 0 });

  const results = await Promise.allSettled([
    debitGenerationCreditInTransaction(db, generationDebitInput("gen_1")),
    debitGenerationCreditInTransaction(db, generationDebitInput("gen_2"))
  ]);

  assertOneSuccessAndOneInsufficientCreditFailure(results);
  assert.equal(state.subscription.usedCredits, 1);
  assert.equal(state.ledgerEntries.length, 1);
  assert.equal(state.ledgerEntries[0]?.amount, -1);
});

test("subscription debit does not create a ledger entry when limit is exhausted", async () => {
  const { db, state } = createSubscriptionDb({ monthlyCreditLimit: 1, usedCredits: 1 });

  await assert.rejects(() => debitGenerationCreditInTransaction(db, generationDebitInput("gen_1")), /Insufficient credits/);
  assert.equal(state.subscription.usedCredits, 1);
  assert.equal(state.ledgerEntries.length, 0);
});

test("subscription refund only decrements usedCredits down to zero and records refund ledger", async () => {
  const { db, state } = createSubscriptionDb({ monthlyCreditLimit: 1, usedCredits: 1 });

  await refundGenerationCreditInTransaction(db, {
    userId: state.user.id,
    amount: 2,
    referenceId: "gen_1",
    chargedSubscriptionId: state.subscription.id,
    note: "Generation failed"
  });

  assert.equal(state.subscription.usedCredits, 0);
  assert.equal(state.ledgerEntries.length, 1);
  assert.equal(state.ledgerEntries[0]?.amount, 2);
  assert.equal(state.ledgerEntries[0]?.reason, "GENERATION_REFUND");
});

function debitInput(referenceId: string) {
  return {
    userId: "user_1",
    amount: -1,
    reason: "GENERATION_DEBIT" as const,
    referenceId,
    note: "Image generation"
  };
}

function generationDebitInput(referenceId: string) {
  return {
    userId: "user_1",
    amount: 1,
    referenceId,
    note: "Image generation"
  };
}

function assertOneSuccessAndOneInsufficientCreditFailure(results: PromiseSettledResult<unknown>[]) {
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const failures = results.filter((result) => result.status === "rejected");
  assert.equal(failures.length, 1);
  assert.match(String(failures[0]?.reason), /Insufficient credits/);
}

function createTrialDb(balance: number) {
  const state = {
    user: { id: "user_1", balance },
    ledgerEntries: [] as LedgerEntry[]
  };

  return {
    state,
    db: {
      user: {
        update: async ({ data }: UserUpdateArgs) => {
          state.user.balance += data.balance.increment;
          return { ...state.user };
        },
        updateMany: async ({ where, data }: UserUpdateManyArgs) => {
          if (where.id !== state.user.id || state.user.balance < where.balance.gte) {
            return { count: 0 };
          }
          state.user.balance -= data.balance.decrement;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({ ...state.user })
      },
      creditLedgerEntry: ledgerStore(state.ledgerEntries)
    } as never
  };
}

function createSubscriptionDb(input: { monthlyCreditLimit: number | null; usedCredits: number }) {
  const activeWindow = {
    currentPeriodStart: new Date(Date.now() - 60_000),
    currentPeriodEnd: new Date(Date.now() + 60_000)
  };
  const state = {
    user: { id: "user_1", balance: 0 },
    subscription: {
      id: "sub_1",
      userId: "user_1",
      status: "ACTIVE",
      plan: "PRO",
      monthlyCreditLimit: input.monthlyCreditLimit,
      usedCredits: input.usedCredits,
      avatarLimit: 5,
      ...activeWindow
    },
    ledgerEntries: [] as LedgerEntry[]
  };

  return {
    state,
    db: {
      user: {
        findUniqueOrThrow: async () => ({ ...state.user })
      },
      userSubscription: {
        findFirst: async () => ({ ...state.subscription }),
        findUnique: async ({ where }: SubscriptionFindUniqueArgs) =>
          where.id === state.subscription.id ? { ...state.subscription } : null,
        update: async ({ data }: SubscriptionUpdateArgs) => {
          state.subscription.usedCredits -= data.usedCredits.decrement;
          return { ...state.subscription };
        },
        updateMany: async ({ where, data }: SubscriptionUpdateManyArgs) => {
          if ("status" in data) {
            return { count: 0 };
          }
          if ("increment" in data.usedCredits) {
            if (where.id !== state.subscription.id || state.subscription.usedCredits > where.usedCredits.lte) {
              return { count: 0 };
            }
            state.subscription.usedCredits += data.usedCredits.increment;
            return { count: 1 };
          }
          if (where.id !== state.subscription.id || state.subscription.usedCredits < where.usedCredits.gte) {
            return { count: 0 };
          }
          state.subscription.usedCredits -= data.usedCredits.decrement;
          return { count: 1 };
        }
      },
      creditLedgerEntry: ledgerStore(state.ledgerEntries)
    } as never
  };
}

function ledgerStore(entries: LedgerEntry[]) {
  return {
    create: async ({ data }: LedgerCreateArgs) => {
      const entry = { id: `ledger_${entries.length + 1}`, ...data };
      entries.push(entry);
      return entry;
    }
  };
}

type LedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  referenceId?: string;
  note?: string;
};

type LedgerCreateArgs = { data: Omit<LedgerEntry, "id"> };
type UserUpdateArgs = { data: { balance: { increment: number } } };
type UserUpdateManyArgs = { where: { id: string; balance: { gte: number } }; data: { balance: { decrement: number } } };
type SubscriptionFindUniqueArgs = { where: { id: string } };
type SubscriptionUpdateArgs = { data: { usedCredits: { decrement: number } } };
type SubscriptionUpdateManyArgs =
  | { where: { status: string; currentPeriodEnd: { lte: Date } }; data: { status: string } }
  | { where: { id: string; usedCredits: { lte: number } }; data: { usedCredits: { increment: number } } }
  | { where: { id: string; usedCredits: { gte: number } }; data: { usedCredits: { decrement: number } } };
