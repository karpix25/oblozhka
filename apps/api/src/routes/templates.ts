import { listTemplates, prisma, seedDefaultTemplates } from "@covers/db";
import type { ProjectPlatform } from "@covers/domain";
import type { FastifyInstance } from "fastify";

export async function templateRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { platform?: ProjectPlatform } }>("/templates", async (request) => {
    return listTemplates(prisma, request.query.platform);
  });

  app.post("/templates/sync-defaults", async () => {
    await seedDefaultTemplates(prisma);
    return listTemplates(prisma);
  });
}
