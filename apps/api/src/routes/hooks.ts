import { listProjectHooks, prisma, selectProjectHook } from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function hookRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string } }>("/projects/:projectId/hooks", async (request) => {
    return listProjectHooks(prisma, request.params.projectId);
  });

  app.post<{ Body: { hookId?: string }; Params: { projectId: string } }>(
    "/projects/:projectId/hooks/select",
    async (request, reply) => {
      if (!request.body.hookId) {
        return reply.code(400).send({ error: "hookId is required" });
      }
      return selectProjectHook(prisma, request.params.projectId, request.body.hookId);
    }
  );
}
