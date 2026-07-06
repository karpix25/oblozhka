import { completePlategaPayment, listPayments, markPlategaPaymentNotSuccessful, prisma } from "@covers/db";
import { normalizePlategaCallback, PlategaClient, type PlategaCallbackPayload } from "@covers/payments";
import type { FastifyInstance } from "fastify";

export async function paymentRoutes(app: FastifyInstance) {
  app.get("/payments", async () => listPayments(prisma));
}

export async function plategaPaymentRoutes(app: FastifyInstance) {
  const platega = new PlategaClient();

  app.post<{ Body: PlategaCallbackPayload }>("/payments/platega/callback", async (request, reply) => {
    const merchantId = headerValue(request.headers["x-merchantid"]);
    const secret = headerValue(request.headers["x-secret"]);
    if (!platega.verifyCallbackHeaders({ merchantId, secret })) {
      return reply.code(401).send({ error: "invalid_platega_auth" });
    }

    const payment = normalizePlategaCallback(request.body);
    if (payment.status === "CONFIRMED") {
      await completePlategaPayment(prisma, {
        providerTransactionId: payment.id,
        providerStatus: payment.status,
        amountRub: payment.amount,
        currency: payment.currency,
        raw: payment.raw as object
      });
      return { ok: true };
    }

    const notSuccessfulStatus = plategaNotSuccessfulStatus(payment.status);
    if (notSuccessfulStatus) {
      await markPlategaPaymentNotSuccessful(prisma, {
        providerTransactionId: payment.id,
        providerStatus: payment.status,
        amountRub: payment.amount,
        currency: payment.currency,
        status: notSuccessfulStatus,
        raw: payment.raw as object
      });
    }

    return { ok: true };
  });
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function plategaNotSuccessfulStatus(status: string) {
  if (status === "CHARGEBACKED" || status === "REFUNDED" || status === "CANCELED" || status === "FAILED") {
    return status;
  }
  return null;
}
