import { findProject, listUserProjects, prisma } from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function projectRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { userId?: string } }>("/projects", async (request, reply) => {
    if (!request.query.userId) {
      return reply.code(400).send({ error: "userId is required for now" });
    }
    return listUserProjects(prisma, request.query.userId);
  });

  app.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const project = await findProject(prisma, request.params.id);
    if (!project) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return project;
  });
}
