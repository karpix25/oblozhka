import type { PaymentStatus } from "@prisma/client";
import type { DbClient } from "./client.js";
import { activateSubscriptionInTransaction } from "./subscriptions.js";

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
    assertPaymentMatches(existing, input);
    if (existing.status === "SUCCEEDED") {
      return existing;
    }

    const payment = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: "SUCCEEDED",
        providerStatus: input.providerStatus,
        confirmedAt: new Date(),
        raw: input.raw
      }
    });

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
  input: PlategaPaymentUpdate & { status: Extract<PaymentStatus, "FAILED" | "CANCELED" | "CHARGEBACKED"> }
) {
  return db.payment.update({
    where: { providerTransactionId: input.providerTransactionId },
    data: {
      status: input.status,
      providerStatus: input.providerStatus,
      failedAt: new Date(),
      raw: input.raw
    }
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
