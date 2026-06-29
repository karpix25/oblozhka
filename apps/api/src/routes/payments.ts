import { listPayments, prisma } from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function paymentRoutes(app: FastifyInstance) {
  app.get("/payments", async () => listPayments(prisma));
}
