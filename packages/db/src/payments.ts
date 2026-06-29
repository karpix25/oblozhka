import type { SuccessfulPayment } from "@covers/telegram-payments";
import type { DbClient } from "./client.js";
import { mutateCreditsInTransaction } from "./credits.js";

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

    await mutateCreditsInTransaction(tx, {
      userId: input.userId,
      amount: payment.creditsGranted,
      reason: "PURCHASE",
      referenceId: payment.id,
      note: "Telegram Stars purchase"
    });

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
