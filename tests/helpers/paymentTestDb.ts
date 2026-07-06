import assert from "node:assert/strict";

export type PaymentRow = {
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

export type LedgerEntry = {
  amount: number;
  referenceId?: string;
  userId: string;
  reason?: string;
  note?: string;
};

export type SubscriptionRow = {
  id: string;
  userId: string;
  sourcePaymentId: string | null;
  status: string;
};

type PaymentUpdateManyArgs = {
  where: { id: string; status?: string | { not: string } };
  data: Partial<PaymentRow>;
};

type UserBalanceMutation = { increment?: number; decrement?: number };

type SubscriptionUpdateManyArgs = {
  where: { userId?: string; sourcePaymentId?: string; status?: string };
  data: { status: string };
};

export function createPaymentDb(
  initialPayment: PaymentRow,
  options: {
    blockInitialProviderReads?: number;
    initialUserBalance?: number;
    subscriptions?: SubscriptionRow[];
  } = {}
) {
  const userRecord = { id: initialPayment.userId, balance: options.initialUserBalance ?? 0 };
  const subscriptionRows = (options.subscriptions ?? []).map((subscription) => ({ ...subscription }));
  const db = {
    paymentRow: { ...initialPayment },
    creditLedgerEntries: [] as LedgerEntry[],
    subscriptionRows,
    userRecord,
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
        if (where.id !== db.paymentRow.id || !paymentStatusMatches(db.paymentRow.status, where.status)) {
          return { count: 0 };
        }
        db.paymentRow = { ...db.paymentRow, ...data };
        return { count: 1 };
      }
    },
    creditLedgerEntry: {
      create: async ({ data }: { data: LedgerEntry }) => {
        db.creditLedgerEntries.push(data);
        return data;
      }
    },
    user: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, userRecord.id);
        return userRecord;
      },
      update: async ({ where, data }: { where: { id: string }; data: { balance: UserBalanceMutation } }) => {
        assert.equal(where.id, userRecord.id);
        applyBalanceMutation(userRecord, data.balance);
        return userRecord;
      },
      updateMany: async ({
        where,
        data
      }: {
        where: { id: string; balance?: { gte: number } };
        data: { balance: UserBalanceMutation };
      }) => {
        if (where.id !== userRecord.id || userRecord.balance < (where.balance?.gte ?? 0)) {
          return { count: 0 };
        }
        applyBalanceMutation(userRecord, data.balance);
        return { count: 1 };
      }
    },
    userSubscription: {
      updateMany: async ({ where, data }: SubscriptionUpdateManyArgs) => {
        let count = 0;
        for (const subscription of subscriptionRows) {
          if (subscriptionMatches(subscription, where)) {
            subscription.status = data.status;
            count += 1;
          }
        }
        return { count };
      },
      create: async ({ data }: { data: Omit<SubscriptionRow, "id" | "status"> & { status?: string } }) => {
        const subscription = {
          id: `subscription-${subscriptionRows.length + 1}`,
          status: data.status ?? "ACTIVE",
          ...data
        };
        subscriptionRows.push(subscription);
        return subscription;
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

  return db;
}

function paymentStatusMatches(currentStatus: string, expectedStatus?: string | { not: string }) {
  if (typeof expectedStatus === "string") {
    return currentStatus === expectedStatus;
  }
  if (expectedStatus?.not) {
    return currentStatus !== expectedStatus.not;
  }
  return true;
}

function subscriptionMatches(subscription: SubscriptionRow, where: SubscriptionUpdateManyArgs["where"]) {
  return (
    (!where.userId || subscription.userId === where.userId) &&
    (!where.sourcePaymentId || subscription.sourcePaymentId === where.sourcePaymentId) &&
    (!where.status || subscription.status === where.status)
  );
}

function applyBalanceMutation(user: { balance: number }, mutation: UserBalanceMutation) {
  user.balance += mutation.increment ?? 0;
  user.balance -= mutation.decrement ?? 0;
}

function clonePayment(payment: PaymentRow) {
  return { ...payment, package: payment.package ? { ...payment.package } : null };
}
