import type { FastifyInstance } from "fastify";
import { collectReadiness } from "./ops/readiness.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  }));

  app.get("/ready", async (_request, reply) => {
    const readiness = await collectReadiness();
    return reply.code(readiness.ok ? 200 : 503).send({
      ...readiness,
      timestamp: new Date().toISOString()
    });
  });
}
