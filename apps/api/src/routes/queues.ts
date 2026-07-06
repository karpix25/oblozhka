import type { FastifyInstance } from "fastify";
import { collectQueueStatuses } from "./ops/queueStatus.js";

export async function queueRoutes(app: FastifyInstance) {
  app.get("/queues/status", async (_request, reply) => {
    try {
      return {
        ok: true,
        timestamp: new Date().toISOString(),
        queues: await collectQueueStatuses()
      };
    } catch (error) {
      return reply.code(503).send({
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Queue status unavailable"
      });
    }
  });
}
