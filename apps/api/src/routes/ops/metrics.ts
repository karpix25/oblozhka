import { collectQueueStatuses, type QueueStatus } from "./queueStatus.js";

export type ProcessMetrics = {
  uptimeSeconds: number;
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
};

export type QueueMetric = {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  backlog: number;
  oldestJobAgeMs: number | null;
};

export type OpsMetrics = {
  ok: boolean;
  timestamp: string;
  process: ProcessMetrics;
  queues: QueueMetric[];
};

export async function collectOpsMetrics(now = new Date()): Promise<OpsMetrics> {
  const queues = await collectQueueStatuses(now);
  return {
    ok: true,
    timestamp: now.toISOString(),
    process: collectProcessMetrics(),
    queues: queues.map(toQueueMetric)
  };
}

export function collectProcessMetrics(memory = process.memoryUsage(), uptimeSeconds = process.uptime()): ProcessMetrics {
  return {
    uptimeSeconds: Math.round(uptimeSeconds),
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers
    }
  };
}

export function toQueueMetric(queue: QueueStatus): QueueMetric {
  const backlog = queue.counts.waiting + queue.counts.delayed;
  return {
    name: queue.name,
    waiting: queue.counts.waiting,
    active: queue.counts.active,
    delayed: queue.counts.delayed,
    failed: queue.counts.failed,
    backlog,
    oldestJobAgeMs: queue.oldestJob?.ageMs ?? null
  };
}
