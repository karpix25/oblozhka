import type { PaymentStatus, Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";
import { reversePurchasedCreditsInTransaction } from "./credits.js";
import { activateSubscriptionInTransaction, cancelSubscriptionsForPaymentInTransaction } from "./subscriptions.js";

export type PendingPlategaPaymentInput = {
  userId: string;
  packageId: string;
  payload: string;
  amountRub: number;
  credits: number;
  providerTransactionId: string;
  providerStatus: string;
  paymentUrl: string;
  expiresAt?: Date;
  raw?: object;
};

export type PlategaPaymentUpdate = {
  providerTransactionId: string;
  providerStatus: string;
  amountRub: number;
  currency: string;
  raw?: object;
};

type PaymentTransaction = Prisma.TransactionClient;
type PaymentReversalStatus = Extract<PaymentStatus, "CHARGEBACKED" | "REFUNDED">;
type NotSuccessfulPaymentStatus = Extract<PaymentStatus, "FAILED" | "CANCELED"> | PaymentReversalStatus;
type PaymentWithPackage = {
  id: string;
  userId: string;
  amountRub: number;
  currency: string;
  status: PaymentStatus;
  creditsGranted: number;
  package: { plan: string | null } | null;
};

export async function createPendingPlategaPayment(db: DbClient, input: PendingPlategaPaymentInput) {
  return db.payment.upsert({
    where: { payload: input.payload },
    create: {
      userId: input.userId,
      packageId: input.packageId,
      payload: input.payload,
      amountRub: input.amountRub,
      currency: "RUB",
      creditsGranted: input.credits,
      providerTransactionId: input.providerTransactionId,
      providerStatus: input.providerStatus,
      paymentUrl: input.paymentUrl,
      expiresAt: input.expiresAt,
      raw: input.raw
    },
    update: {
      providerTransactionId: input.providerTransactionId,
      providerStatus: input.providerStatus,
      paymentUrl: input.paymentUrl,
      expiresAt: input.expiresAt,
      raw: input.raw
    },
    include: { package: true }
  });
}

export async function completePlategaPayment(db: DbClient, input: PlategaPaymentUpdate) {
  return db.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { providerTransactionId: input.providerTransactionId },
      include: { package: true }
    });

    if (!existing) {
      throw new Error("Payment was not found for Platega transaction.");
    }
    if (existing.status === "SUCCEEDED") {
      return existing;
    }
    assertPaymentMatches(existing, input);

    const payment = await claimPlategaPaymentCompletion(tx, existing.id, input);
    if (!payment) {
      return findSucceededPayment(tx, existing.id);
    }

    if (existing.package?.plan) {
      await activateSubscriptionInTransaction(tx, {
        userId: existing.userId,
        plan: existing.package.plan,
        sourcePaymentId: payment.id
      });
    } else if (payment.creditsGranted > 0) {
      await tx.creditLedgerEntry.create({
        data: {
          userId: existing.userId,
          amount: payment.creditsGranted,
          reason: "PURCHASE",
          referenceId: payment.id,
          note: "Credits purchase"
        }
      });
      await tx.user.update({
        where: { id: existing.userId },
        data: { balance: { increment: payment.creditsGranted } }
      });
    }

    return payment;
  });
}

export async function markPlategaPaymentNotSuccessful(
  db: DbClient,
  input: PlategaPaymentUpdate & { status: NotSuccessfulPaymentStatus }
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { providerTransactionId: input.providerTransactionId },
      include: { package: true }
    });
    if (!existing) {
      throw new Error("Payment was not found for Platega transaction.");
    }
    assertPaymentMatches(existing, input);

    if (existing.status === "SUCCEEDED") {
      if (isPaymentReversalStatus(input.status)) {
        return reverseSucceededPayment(tx, existing, { ...input, status: input.status });
      }
      return existing;
    }

    if (isPaymentReversalStatus(existing.status)) {
      return existing;
    }

    const updateResult = await tx.payment.updateMany({
      where: { id: existing.id, status: { not: "SUCCEEDED" } },
      data: {
        status: input.status,
        providerStatus: input.providerStatus,
        failedAt: new Date(),
        raw: input.raw
      }
    });

    if (updateResult.count === 0) {
      return findPaymentById(tx, existing.id);
    }
    return findPaymentById(tx, existing.id);
  });
}

export async function findPaymentByProviderTransaction(db: DbClient, providerTransactionId: string) {
  return db.payment.findUnique({
    where: { providerTransactionId },
    include: { user: true, package: true }
  });
}

export async function listPayments(db: DbClient) {
  return db.payment.findMany({
    include: { user: true, package: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

function assertPaymentMatches(existing: { amountRub: number; currency: string }, input: PlategaPaymentUpdate) {
  if (existing.currency !== "RUB" || input.currency !== "RUB") {
    throw new Error("Payment currency mismatch.");
  }
  if (existing.amountRub !== input.amountRub) {
    throw new Error("Payment amount mismatch.");
  }
}

async function claimPlategaPaymentCompletion(
  tx: PaymentTransaction,
  paymentId: string,
  input: PlategaPaymentUpdate
) {
  const updateResult = await tx.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: {
      status: "SUCCEEDED",
      providerStatus: input.providerStatus,
      confirmedAt: new Date(),
      failedAt: null,
      raw: input.raw
    }
  });

  if (updateResult.count === 0) {
    return null;
  }
  return findPaymentById(tx, paymentId);
}

async function findSucceededPayment(tx: PaymentTransaction, paymentId: string) {
  const payment = await findPaymentById(tx, paymentId);
  if (payment.status !== "SUCCEEDED") {
    throw new Error("Payment completion was not confirmed.");
  }
  return payment;
}

async function reverseSucceededPayment(
  tx: PaymentTransaction,
  existing: PaymentWithPackage,
  input: PlategaPaymentUpdate & { status: PaymentReversalStatus }
) {
  const payment = await claimPlategaPaymentReversal(tx, existing.id, input);
  if (!payment) {
    return findPaymentById(tx, existing.id);
  }

  if (existing.package?.plan) {
    await cancelSubscriptionsForPaymentInTransaction(tx, {
      userId: existing.userId,
      sourcePaymentId: payment.id
    });
    return payment;
  }

  if (payment.creditsGranted > 0) {
    await reversePurchasedCreditsInTransaction(tx, {
      userId: payment.userId,
      amount: payment.creditsGranted,
      referenceId: payment.id,
      note: `${input.status} payment reversal`
    });
  }

  return payment;
}

async function claimPlategaPaymentReversal(
  tx: PaymentTransaction,
  paymentId: string,
  input: PlategaPaymentUpdate & { status: PaymentReversalStatus }
) {
  const updateResult = await tx.payment.updateMany({
    where: { id: paymentId, status: "SUCCEEDED" },
    data: {
      status: input.status,
      providerStatus: input.providerStatus,
      failedAt: new Date(),
      raw: input.raw
    }
  });

  if (updateResult.count === 0) {
    return null;
  }
  return findPaymentById(tx, paymentId);
}

async function findPaymentById(tx: PaymentTransaction, paymentId: string) {
  return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
}

function isPaymentReversalStatus(status: PaymentStatus): status is PaymentReversalStatus {
  return status === "CHARGEBACKED" || status === "REFUNDED";
}
