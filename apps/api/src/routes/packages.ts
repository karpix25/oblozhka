import { createPackage, listPackages, prisma, updatePackage } from "@covers/db";
import type { CreditPackageInput } from "@covers/domain";
import type { FastifyInstance } from "fastify";

export async function packageRoutes(app: FastifyInstance) {
  app.get("/packages", async () => listPackages(prisma));

  app.post<{ Body: CreditPackageInput }>("/packages", async (request, reply) => {
    if (!request.body.title || !request.body.starsPrice || !request.body.credits) {
      return reply.code(400).send({ error: "title, starsPrice and credits are required" });
    }
    return createPackage(prisma, request.body);
  });

  app.patch<{ Body: Partial<CreditPackageInput>; Params: { id: string } }>(
    "/packages/:id",
    async (request) => updatePackage(prisma, request.params.id, request.body)
  );
}
