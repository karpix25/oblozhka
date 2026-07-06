import test from "node:test";
import assert from "node:assert/strict";
import { completePlategaPayment, markPlategaPaymentNotSuccessful } from "../packages/db/src/payments.js";

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

type PaymentRow = {
  id: string;
  userId: string;
  amountRub: number;
  currency: string;
  creditsGranted: number;
  providerTransactionId: string;
  providerStatus: string;
  status: string;
  package: { plan: string | null } | null;
  confirmedAt?: Date | null;
  failedAt?: Date | null;
  raw?: object;
};

type PaymentUpdateManyArgs = {
  where: { id: string; status?: string | { not: string } };
  data: Partial<PaymentRow>;
};

function createPaymentDb(initialPayment: PaymentRow, options: { blockInitialProviderReads?: number } = {}) {
  const userRecord = { id: initialPayment.userId, balance: 0 };
  const db = {
    paymentRow: { ...initialPayment },
    creditLedgerEntries: [] as Array<{ amount: number; referenceId: string; userId: string }>,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    payment: {
      findUnique: async ({ where }: { where: { providerTransactionId?: string; id?: string } }) => {
        if (where.providerTransactionId) {
          await waitForProviderReadBarrier();
          return where.providerTransactionId === db.paymentRow.providerTransactionId ? clonePayment(db.paymentRow) : null;
        }
        return where.id === db.paymentRow.id ? clonePayment(db.paymentRow) : null;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, db.paymentRow.id);
        return clonePayment(db.paymentRow);
      },
      updateMany: async ({ where, data }: PaymentUpdateManyArgs) => {
        const statusMatches =
          typeof where.status === "string"
            ? db.paymentRow.status === where.status
            : where.status?.not
              ? db.paymentRow.status !== where.status.not
              : true;
        if (where.id !== db.paymentRow.id || !statusMatches) {
          return { count: 0 };
        }
        db.paymentRow = { ...db.paymentRow, ...data };
        return { count: 1 };
      }
    },
    creditLedgerEntry: {
      create: async ({ data }: { data: { amount: number; referenceId: string; userId: string } }) => {
        db.creditLedgerEntries.push(data);
        return data;
      }
    },
    user: {
      update: async ({ where, data }: { where: { id: string }; data: { balance: { increment: number } } }) => {
        assert.equal(where.id, userRecord.id);
        userRecord.balance += data.balance.increment;
        return userRecord;
      }
    }
  };

  let providerReads = 0;
  let releaseProviderReads: (() => void) | undefined;
  const providerReadBarrier = new Promise<void>((resolve) => {
    releaseProviderReads = resolve;
  });

  async function waitForProviderReadBarrier() {
    const blockedReads = options.blockInitialProviderReads ?? 0;
    if (blockedReads === 0 || providerReads >= blockedReads) {
      return;
    }
    providerReads += 1;
    if (providerReads >= blockedReads) {
      releaseProviderReads?.();
    }
    await providerReadBarrier;
  }

  return Object.assign(db, { userRecord });
}

function clonePayment(payment: PaymentRow) {
  return { ...payment, package: payment.package ? { ...payment.package } : null };
}
