import { getAdminAnalyticsSummary, prisma } from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/summary", async () => getAdminAnalyticsSummary(prisma));
}
