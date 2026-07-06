import test from "node:test";
import assert from "node:assert/strict";
import { completePlategaPayment, markPlategaPaymentNotSuccessful } from "../packages/db/src/payments.js";
import { createPaymentDb } from "./helpers/paymentTestDb.js";

test("completePlategaPayment grants credits once for duplicate concurrent completions", async () => {
  const db = createPaymentDb({
    id: "payment-1",
    userId: "user-1",
    amountRub: 199,
    currency: "RUB",
    creditsGranted: 10,
    providerTransactionId: "tx-1",
    providerStatus: "PENDING",
    status: "PENDING",
    package: { plan: null }
  }, { blockInitialProviderReads: 2 });

  const input = {
    providerTransactionId: "tx-1",
    providerStatus: "CONFIRMED",
    amountRub: 199,
    currency: "RUB",
    raw: { status: "CONFIRMED" }
  };

  const [first, second] = await Promise.all([
    completePlategaPayment(db as never, input),
    completePlategaPayment(db as never, input)
  ]);

  assert.equal(first.status, "SUCCEEDED");
  assert.equal(second.status, "SUCCEEDED");
  assert.equal(db.creditLedgerEntries.length, 1);
  assert.equal(db.userRecord.balance, 10);
});

test("markPlategaPaymentNotSuccessful does not downgrade a succeeded payment", async () => {
  const db = createPaymentDb({
    id: "payment-2",
    userId: "user-2",
    amountRub: 499,
    currency: "RUB",
    creditsGranted: 50,
    providerTransactionId: "tx-2",
    providerStatus: "CONFIRMED",
    status: "SUCCEEDED",
    confirmedAt: new Date("2026-07-06T00:00:00.000Z"),
    failedAt: null,
    package: { plan: null }
  });

  const payment = await markPlategaPaymentNotSuccessful(db as never, {
    providerTransactionId: "tx-2",
    providerStatus: "FAILED",
    amountRub: 499,
    currency: "RUB",
    status: "FAILED",
    raw: { status: "FAILED" }
  });

  assert.equal(payment.status, "SUCCEEDED");
  assert.equal(db.paymentRow.status, "SUCCEEDED");
  assert.equal(db.paymentRow.providerStatus, "CONFIRMED");
  assert.equal(db.paymentRow.failedAt, null);
});

test("completePlategaPayment does not grant access after a payment is already failed", async () => {
  const db = createPaymentDb({
    id: "payment-3",
    userId: "user-3",
    amountRub: 199,
    currency: "RUB",
    creditsGranted: 10,
    providerTransactionId: "tx-3",
    providerStatus: "FAILED",
    status: "FAILED",
    failedAt: new Date("2026-07-06T00:00:00.000Z"),
    package: { plan: null }
  });

  await assert.rejects(
    () =>
      completePlategaPayment(db as never, {
        providerTransactionId: "tx-3",
        providerStatus: "CONFIRMED",
        amountRub: 199,
        currency: "RUB",
        raw: { status: "CONFIRMED" }
      }),
    /Payment completion was not confirmed/
  );

  assert.equal(db.paymentRow.status, "FAILED");
  assert.equal(db.creditLedgerEntries.length, 0);
  assert.equal(db.userRecord.balance, 0);
});
