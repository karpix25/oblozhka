import type { DbClient } from "./client.js";
import type { ProductEventName, ProductEventRecord } from "./productEvents.js";

export const CJM_FUNNEL_STEPS = [
  "project_started",
  "source_submitted",
  "platform_selected",
  "templates_shown",
  "template_selected",
  "hooks_ready",
  "hook_selected",
  "reference_selected",
  "generation_started",
  "generation_succeeded"
] as const satisfies readonly ProductEventName[];

export type PercentileMetric = {
  sampleSize: number;
  p50Ms: number | null;
  p90Ms: number | null;
};

export type FunnelStep = {
  name: (typeof CJM_FUNNEL_STEPS)[number];
  count: number;
  conversionFromPrevious: number | null;
  conversionFromStart: number | null;
};

export type CjmAnalytics = {
  windowDays: number;
  funnel: FunnelStep[];
  journeyDurations: {
    sourceToTemplates: PercentileMetric;
    hooksPreparation: PercentileMetric;
    timeToGeneration: PercentileMetric;
  };
  generationDurations: {
    queue: PercentileMetric;
    processing: PercentileMetric;
    total: PercentileMetric;
  };
};

type ProductEventDelegate = {
  findMany(args: object): Promise<ProductEventRecord[]>;
};

type GenerationTimingDelegate = {
  findMany(args: object): Promise<Array<{
    queuedAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>>;
};

export async function getProductFunnel(
  db: DbClient,
  options: { from?: Date; to?: Date } = {}
): Promise<FunnelStep[]> {
  const delegate = optionalProductEventDelegate(db);
  if (!delegate) {
    return emptyFunnel();
  }
  const events = await delegate.findMany({
    where: {
      name: { in: [...CJM_FUNNEL_STEPS] },
      createdAt: { gte: options.from, lt: options.to }
    },
    select: { id: true, name: true, userId: true, projectId: true, generationId: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  });
  return buildFunnel(events);
}

export async function getCjmAnalytics(
  db: DbClient,
  options: { now?: Date; windowDays?: number } = {}
): Promise<CjmAnalytics> {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? 30;
  const from = new Date(now.getTime() - windowDays * 86_400_000);
  const eventDelegate = optionalProductEventDelegate(db);
  const generationDelegate = optionalGenerationDelegate(db);

  const [events, generations] = await Promise.all([
    eventDelegate
      ? eventDelegate.findMany({
          where: { createdAt: { gte: from, lt: now } },
          select: { id: true, name: true, userId: true, projectId: true, generationId: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        })
      : [],
    generationDelegate
      ? generationDelegate.findMany({
          where: { queuedAt: { gte: from, lt: now } },
          select: { queuedAt: true, startedAt: true, finishedAt: true }
        })
      : []
  ]);

  return {
    windowDays,
    funnel: buildFunnel(events),
    journeyDurations: buildJourneyDurations(events),
    generationDurations: buildGenerationDurations(generations)
  };
}

function buildFunnel(events: ProductEventRecord[]): FunnelStep[] {
  const entities = new Map<ProductEventName, Set<string>>();
  for (const name of CJM_FUNNEL_STEPS) {
    entities.set(name, new Set());
  }
  for (const event of events) {
    if (!entities.has(event.name) || !event.projectId) continue;
    entities.get(event.name)?.add(event.projectId);
  }

  const startProjects = entities.get(CJM_FUNNEL_STEPS[0]) ?? new Set<string>();
  let previousProjects = startProjects;
  return CJM_FUNNEL_STEPS.map((name, index) => {
    const currentProjects = index === 0
      ? startProjects
      : intersection(previousProjects, entities.get(name) ?? new Set<string>());
    const count = currentProjects.size;
    const previous = index > 0 ? previousProjects.size : 0;
    previousProjects = currentProjects;
    return {
      name,
      count,
      conversionFromPrevious: index === 0 ? null : percentage(count, previous),
      conversionFromStart: index === 0 ? (count > 0 ? 100 : null) : percentage(count, startProjects.size)
    };
  });
}

function intersection(left: Set<string>, right: Set<string>) {
  return new Set([...left].filter((value) => right.has(value)));
}

function emptyFunnel() {
  return buildFunnel([]);
}

function buildJourneyDurations(events: ProductEventRecord[]) {
  return {
    sourceToTemplates: durationBetween(events, "source_submitted", "templates_shown"),
    hooksPreparation: durationBetween(events, "hooks_started", "hooks_ready"),
    timeToGeneration: durationBetween(events, "project_started", "generation_started")
  };
}

function durationBetween(events: ProductEventRecord[], start: ProductEventName, end: ProductEventName) {
  const starts = new Map<string, number>();
  const durations: number[] = [];
  for (const event of events) {
    const entity = event.projectId ?? event.generationId;
    if (!entity) continue;
    if (event.name === start && !starts.has(entity)) starts.set(entity, event.createdAt.getTime());
    if (event.name === end) {
      const startedAt = starts.get(entity);
      if (startedAt !== undefined && event.createdAt.getTime() >= startedAt) {
        durations.push(event.createdAt.getTime() - startedAt);
        starts.delete(entity);
      }
    }
  }
  return percentileMetric(durations);
}

function buildGenerationDurations(
  generations: Array<{ queuedAt: Date; startedAt: Date | null; finishedAt: Date | null }>
) {
  const queue: number[] = [];
  const processing: number[] = [];
  const total: number[] = [];
  for (const generation of generations) {
    pushDuration(queue, generation.queuedAt, generation.startedAt);
    pushDuration(processing, generation.startedAt, generation.finishedAt);
    pushDuration(total, generation.queuedAt, generation.finishedAt);
  }
  return {
    queue: percentileMetric(queue),
    processing: percentileMetric(processing),
    total: percentileMetric(total)
  };
}

function pushDuration(target: number[], start: Date | null, end: Date | null) {
  if (!start || !end) return;
  const duration = end.getTime() - start.getTime();
  if (duration >= 0) target.push(duration);
}

export function percentileMetric(values: number[]): PercentileMetric {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    sampleSize: sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p90Ms: percentile(sorted, 0.9)
  };
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function percentage(value: number, base: number) {
  return base > 0 ? Math.round((value / base) * 1000) / 10 : null;
}

function optionalProductEventDelegate(db: DbClient) {
  return (db as unknown as { productEvent?: ProductEventDelegate }).productEvent;
}

function optionalGenerationDelegate(db: DbClient) {
  return (db as unknown as { generation?: GenerationTimingDelegate }).generation?.findMany
    ? (db as unknown as { generation: GenerationTimingDelegate }).generation
    : undefined;
}
