import { createAuditLog, listLedger, listUsers, mutateCredits, prisma } from "@covers/db";
import type { FastifyInstance } from "fastify";

type AdjustmentBody = {
  amount?: number;
  note?: string;
};

export async function userRoutes(app: FastifyInstance) {
  app.get("/users", async () => listUsers(prisma));

  app.get<{ Params: { id: string } }>("/users/:id/ledger", async (request) => {
    return listLedger(prisma, request.params.id);
  });

  app.post<{ Body: AdjustmentBody; Params: { id: string } }>(
    "/users/:id/credits",
    async (request, reply) => {
      const amount = request.body.amount;
      if (amount === undefined || !Number.isInteger(amount) || amount === 0) {
        return reply.code(400).send({ error: "amount must be a non-zero integer" });
      }

      const result = await mutateCredits(prisma, {
        userId: request.params.id,
        amount,
        reason: "MANUAL_ADJUSTMENT",
        note: request.body.note
      });
      await createAuditLog(prisma, {
        actor: "admin",
        action: "credits.adjust",
        target: request.params.id,
        metadata: { amount, note: request.body.note }
      });
      return result;
    }
  );
}
