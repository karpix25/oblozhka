import type { Prisma } from "@prisma/client";
import type { DbClient } from "./client.js";

export const PRODUCT_EVENT_NAMES = [
  "project_started",
  "source_type_selected",
  "source_submitted",
  "platform_selected",
  "templates_shown",
  "template_selected",
  "hooks_started",
  "hooks_ready",
  "hook_selected",
  "reference_selected",
  "generation_started",
  "generation_succeeded",
  "generation_failed",
  "project_resumed",
  "step_abandoned"
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export type RecordProductEventInput = {
  name: ProductEventName;
  userId?: string;
  projectId?: string;
  generationId?: string;
  metadata?: Prisma.InputJsonValue;
  createdAt?: Date;
};

export type ProductEventFilters = {
  names?: readonly ProductEventName[];
  userId?: string;
  projectId?: string;
  generationId?: string;
  from?: Date;
  to?: Date;
  take?: number;
};

export type ProductEventRecord = {
  id: string;
  name: ProductEventName;
  userId: string | null;
  projectId: string | null;
  generationId: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function recordProductEvent(db: DbClient, input: RecordProductEventInput) {
  return db.productEvent.create({
    data: {
      name: input.name,
      userId: input.userId,
      projectId: input.projectId,
      generationId: input.generationId,
      metadata: input.metadata,
      createdAt: input.createdAt
    }
  });
}

export async function listProductEvents(
  db: DbClient,
  filters: ProductEventFilters = {}
): Promise<ProductEventRecord[]> {
  const createdAt = dateRange(filters.from, filters.to);
  const rows = await db.productEvent.findMany({
    where: {
      name: filters.names?.length ? { in: [...filters.names] } : undefined,
      userId: filters.userId,
      projectId: filters.projectId,
      generationId: filters.generationId,
      createdAt
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(filters.take ?? 100, 1), 500)
  });

  return rows.map((event) => ({ ...event, name: event.name as ProductEventName }));
}

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) {
    return undefined;
  }
  return { gte: from, lt: to };
}
