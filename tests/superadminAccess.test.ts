import test from "node:test";
import assert from "node:assert/strict";
import { debitGenerationCreditInTransaction } from "../packages/db/src/credits.js";
import { generationBillingData } from "../packages/db/src/generationBilling.js";
import { getBillingAccess } from "../packages/db/src/subscriptions.js";
import { isSuperadminTelegramId, readSuperadminTelegramIds } from "../packages/db/src/superadmin.js";

test("owner Telegram id is always recognized as superadmin", () => {
  assert.equal(isSuperadminTelegramId(38061745n, {}), true);
  assert.deepEqual([...readSuperadminTelegramIds({ SUPERADMIN_TELEGRAM_IDS: "123, 456" })], [
    "38061745",
    "123",
    "456"
  ]);
});

test("superadmin receives unlimited Business access", async () => {
  const { db } = createSuperadminDb();
  const access = await getBillingAccess(db, "user_1");

  assert.deepEqual(access, {
    kind: "superadmin",
    plan: "BUSINESS",
    remainingCredits: null,
    monthlyCreditLimit: null,
    avatarLimit: null,
    queuePriority: 1,
    currentPeriodEnd: null
  });
});

test("superadmin generation does not debit balance or create ledger entries", async () => {
  const { db, state } = createSuperadminDb();
  const result = await debitGenerationCreditInTransaction(db, {
    userId: state.user.id,
    amount: 1,
    referenceId: "gen_1",
    note: "Image generation"
  });

  assert.equal(result.access.kind, "superadmin");
  assert.equal(result.ledgerEntry, null);
  assert.equal(state.user.balance, 0);
  assert.equal(state.ledgerEntries.length, 0);
  assert.deepEqual(generationBillingData(result.access), {
    chargedPlan: "BUSINESS",
    creditCost: 0,
    queuePriority: 1
  });
});

function createSuperadminDb() {
  const state = {
    user: { id: "user_1", telegramId: 38061745n, balance: 0 },
    ledgerEntries: [] as object[]
  };

  return {
    state,
    db: {
      user: {
        findUniqueOrThrow: async () => ({ ...state.user })
      },
      creditLedgerEntry: {
        create: async ({ data }: { data: object }) => {
          state.ledgerEntries.push(data);
          return data;
        }
      }
    } as never
  };
}
