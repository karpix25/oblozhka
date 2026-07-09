import { createAuditLog, createPackage, listPackages, prisma, updatePackage } from "@covers/db";
import type { CreditPackageInput } from "@covers/domain";
import type { FastifyInstance } from "fastify";

export async function packageRoutes(app: FastifyInstance) {
  app.get("/packages", async () => listPackages(prisma));

  app.post<{ Body: CreditPackageInput }>("/packages", async (request, reply) => {
    if (!request.body.title || !Number.isInteger(request.body.priceRub) || !Number.isInteger(request.body.credits)) {
      return reply.code(400).send({ error: "title, priceRub and credits are required" });
    }
    return createPackage(prisma, request.body);
  });

  app.patch<{ Body: Partial<CreditPackageInput>; Params: { id: string } }>(
    "/packages/:id",
    async (request, reply) => {
      const previous = await prisma.creditPackage.findUnique({
        where: { id: request.params.id }
      });
      if (!previous) {
        return reply.code(404).send({ error: "package_not_found" });
      }

      const updated = await updatePackage(prisma, request.params.id, request.body);
      await createAuditLog(prisma, {
        actor: "admin",
        action: "package.update",
        target: request.params.id,
        metadata: {
          changes: request.body,
          before: packageAuditSnapshot(previous),
          after: packageAuditSnapshot(updated)
        }
      });
      return updated;
    }
  );
}

function packageAuditSnapshot(pkg: {
  slug: string | null;
  plan: string | null;
  title: string;
  description: string | null;
  priceRub: number;
  credits: number;
  isActive: boolean;
}) {
  return {
    slug: pkg.slug,
    plan: pkg.plan,
    title: pkg.title,
    description: pkg.description,
    priceRub: pkg.priceRub,
    credits: pkg.credits,
    isActive: pkg.isActive
  };
}
