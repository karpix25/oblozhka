import { listGenerations, prisma } from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function generationRoutes(app: FastifyInstance) {
  app.get("/generations", async () => listGenerations(prisma));
}
