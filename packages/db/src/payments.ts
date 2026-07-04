import type { SuccessfulPayment } from "@covers/telegram-payments";
import type { DbClient } from "./client.js";
import { activateSubscriptionInTransaction } from "./subscriptions.js";

export async function createPendingPayment(
  db: DbClient,
  input: { userId: string; packageId: string; payload: string; starsAmount: number; credits: number }
) {
  return db.payment.upsert({
    where: { payload: input.payload },
    create: {
      userId: input.userId,
      packageId: input.packageId,
      payload: input.payload,
      starsAmount: input.starsAmount,
      creditsGranted: input.credits
    },
    update: {}
  });
}

export async function completeStarsPayment(
  db: DbClient,
  input: { userId: string; payment: SuccessfulPayment }
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { payload: input.payment.invoicePayload }
    });

    if (!existing || existing.status === "SUCCEEDED") {
      return existing;
    }

    const payment = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: "SUCCEEDED",
        telegramPaymentChargeId: input.payment.telegramPaymentChargeId,
        providerPaymentChargeId: input.payment.providerPaymentChargeId,
        raw: input.payment.raw
      }
    });

    const pack = existing.packageId
      ? await tx.creditPackage.findUnique({ where: { id: existing.packageId } })
      : null;

    if (pack?.plan) {
      await activateSubscriptionInTransaction(tx, {
        userId: input.userId,
        plan: pack.plan,
        sourcePaymentId: payment.id
      });
    } else if (payment.creditsGranted > 0) {
      await tx.creditLedgerEntry.create({
        data: {
          userId: input.userId,
          amount: payment.creditsGranted,
          reason: "PURCHASE",
          referenceId: payment.id,
          note: "Legacy credits purchase"
        }
      });
      await tx.user.update({
        where: { id: input.userId },
        data: { balance: { increment: payment.creditsGranted } }
      });
    }

    return payment;
  });
}

export async function listPayments(db: DbClient) {
  return db.payment.findMany({
    include: { user: true, package: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}
