import {
  getAdminAnalyticsSummary,
  listProductEvents,
  PRODUCT_EVENT_NAMES,
  prisma,
  type ProductEventName
} from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/summary", async () => getAdminAnalyticsSummary(prisma));

  app.get<{ Querystring: AnalyticsEventsQuery }>("/analytics/events", async (request, reply) => {
    const names = parseEventNames(request.query.names);
    if (request.query.names && !names) {
      return reply.code(400).send({ error: "Unknown product event name" });
    }

    return listProductEvents(prisma, {
      names,
      userId: request.query.userId,
      projectId: request.query.projectId,
      generationId: request.query.generationId,
      from: parseDate(request.query.from),
      to: parseDate(request.query.to),
      take: parseTake(request.query.take)
    });
  });
}

type AnalyticsEventsQuery = {
  names?: string;
  userId?: string;
  projectId?: string;
  generationId?: string;
  from?: string;
  to?: string;
  take?: string;
};

function parseEventNames(value?: string): ProductEventName[] | undefined {
  if (!value) return undefined;
  const names = value.split(",");
  return names.every((name): name is ProductEventName => PRODUCT_EVENT_NAMES.includes(name as ProductEventName))
    ? names
    : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseTake(value?: string) {
  if (!value) return undefined;
  const take = Number(value);
  return Number.isInteger(take) ? take : undefined;
}
