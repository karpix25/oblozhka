import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const PUBLIC_PATHS = new Set(["/health", "/ready", "/payments/platega/callback"]);

export async function registerAdminAuth(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (PUBLIC_PATHS.has(request.url.split("?")[0])) {
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

  if (!isAdminBearerAuthorized(header, expected)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export function isAdminBearerAuthorized(header: string | undefined, expectedToken: string) {
  return header === `Bearer ${expectedToken}`;
}
