import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export async function registerAdminAuth(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") {
      return;
    }
    await requireAdminToken(request, reply);
  });
}

async function requireAdminToken(request: FastifyRequest, reply: FastifyReply) {
  const expected = process.env.ADMIN_TOKEN;
  const header = request.headers.authorization;

  if (!expected) {
    return reply.code(500).send({ error: "ADMIN_TOKEN is not configured." });
  }

  if (header !== `Bearer ${expected}`) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}
