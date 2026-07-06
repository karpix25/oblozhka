import type { FastifyInstance } from "fastify";
import { collectOpsAlertReport } from "./ops/alerts.js";
import { collectOpsMetrics } from "./ops/metrics.js";

export async function opsRoutes(app: FastifyInstance) {
  app.get("/ops/metrics", async (_request, reply) => {
    try {
      return await collectOpsMetrics();
    } catch (error) {
      return reply.code(503).send({
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Ops metrics unavailable"
      });
    }
  });

  app.get("/ops/alerts", async (_request, reply) => {
    try {
      const report = await collectOpsAlertReport();
      return reply.code(report.ok ? 200 : 503).send(report);
    } catch (error) {
      return reply.code(503).send({
        ok: false,
        level: "critical",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Ops alerts unavailable"
      });
    }
  });
}
