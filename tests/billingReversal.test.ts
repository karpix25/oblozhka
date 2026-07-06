import test from "node:test";
import assert from "node:assert/strict";
import { markPlategaPaymentNotSuccessful } from "../packages/db/src/payments.js";
import { createPaymentDb } from "./helpers/paymentTestDb.js";

test("chargeback after succeeded credit package reverses access once without negative balance", async () => {
  const db = createPaymentDb(
    {
      id: "payment-credits",
      userId: "user-credits",
      amountRub: 199,
      currency: "RUB",
      creditsGranted: 10,
      providerTransactionId: "tx-credits",
      providerStatus: "CONFIRMED",
      status: "SUCCEEDED",
      confirmedAt: new Date("2026-07-06T00:00:00.000Z"),
      failedAt: null,
      package: { plan: null }
    },
    { initialUserBalance: 4 }
  );

  const input = {
    providerTransactionId: "tx-credits",
    providerStatus: "CHARGEBACKED",
    amountRub: 199,
    currency: "RUB",
    status: "CHARGEBACKED" as const,
    raw: { status: "CHARGEBACKED" }
  };

  const first = await markPlategaPaymentNotSuccessful(db as never, input);
  const second = await markPlategaPaymentNotSuccessful(db as never, input);

  assert.equal(first.status, "CHARGEBACKED");
  assert.equal(second.status, "CHARGEBACKED");
  assert.equal(db.paymentRow.status, "CHARGEBACKED");
  assert.equal(db.userRecord.balance, 0);
  assert.deepEqual(db.creditLedgerEntries, [
    {
      userId: "user-credits",
      amount: -10,
      reason: "MANUAL_ADJUSTMENT",
      referenceId: "payment-credits",
      note: "CHARGEBACKED payment reversal"
    }
  ]);
});

test("refund after succeeded subscription cancels paid access once", async () => {
  const db = createPaymentDb(
    {
      id: "payment-subscription",
      userId: "user-subscription",
      amountRub: 499,
      currency: "RUB",
      creditsGranted: 500,
      providerTransactionId: "tx-subscription",
      providerStatus: "CONFIRMED",
      status: "SUCCEEDED",
      confirmedAt: new Date("2026-07-06T00:00:00.000Z"),
      failedAt: null,
      package: { plan: "PRO" }
    },
    {
      subscriptions: [
        {
          id: "subscription-current",
          userId: "user-subscription",
          sourcePaymentId: "payment-subscription",
          status: "ACTIVE"
        },
        {
          id: "subscription-next",
          userId: "user-subscription",
          sourcePaymentId: "payment-other",
          status: "ACTIVE"
        }
      ]
    }
  );

  const input = {
    providerTransactionId: "tx-subscription",
    providerStatus: "REFUNDED",
    amountRub: 499,
    currency: "RUB",
    status: "REFUNDED" as const,
    raw: { status: "REFUNDED" }
  };

  const first = await markPlategaPaymentNotSuccessful(db as never, input);
  const second = await markPlategaPaymentNotSuccessful(db as never, input);

  assert.equal(first.status, "REFUNDED");
  assert.equal(second.status, "REFUNDED");
  assert.equal(db.paymentRow.status, "REFUNDED");
  assert.equal(db.subscriptionRows[0]?.status, "CANCELED");
  assert.equal(db.subscriptionRows[1]?.status, "ACTIVE");
  assert.equal(db.creditLedgerEntries.length, 0);
});
