import { collectOpsMetrics, type OpsMetrics, type QueueMetric } from "./metrics.js";
import { readOpsAlertThresholds, type OpsAlertThresholds } from "./alertThresholds.js";

export type OpsAlertLevel = "ok" | "warn" | "critical";

export type OpsAlert = {
  level: Exclude<OpsAlertLevel, "ok">;
  code: string;
  message: string;
  queue?: string;
  value: number;
  threshold: number;
};

export type OpsAlertReport = {
  ok: boolean;
  level: OpsAlertLevel;
  timestamp: string;
  alerts: OpsAlert[];
  metrics: OpsMetrics;
};

export async function collectOpsAlertReport(now = new Date()): Promise<OpsAlertReport> {
  const metrics = await collectOpsMetrics(now);
  const alerts = evaluateOpsAlerts(metrics, readOpsAlertThresholds());
  return {
    ok: !alerts.some((alert) => alert.level === "critical"),
    level: alertLevel(alerts),
    timestamp: metrics.timestamp,
    alerts,
    metrics
  };
}

export function evaluateOpsAlerts(metrics: OpsMetrics, thresholds: OpsAlertThresholds): OpsAlert[] {
  return metrics.queues.flatMap((queue) => queueAlerts(queue, thresholds));
}

function queueAlerts(queue: QueueMetric, thresholds: OpsAlertThresholds): OpsAlert[] {
  return [
    thresholdAlert({
      queue: queue.name,
      code: "queue_backlog_high",
      message: "Queue backlog is above threshold.",
      value: queue.backlog,
      warn: thresholds.queueBacklogWarn,
      critical: thresholds.queueBacklogCritical
    }),
    thresholdAlert({
      queue: queue.name,
      code: "queue_failed_high",
      message: "Queue failed jobs count is above threshold.",
      value: queue.failed,
      warn: thresholds.queueFailedWarn,
      critical: thresholds.queueFailedCritical
    }),
    queue.oldestJobAgeMs === null
      ? null
      : thresholdAlert({
          queue: queue.name,
          code: "queue_oldest_job_stale",
          message: "Oldest queue job age is above threshold.",
          value: queue.oldestJobAgeMs,
          warn: thresholds.queueOldestJobWarnMs,
          critical: thresholds.queueOldestJobCriticalMs
        })
  ].filter((alert): alert is OpsAlert => Boolean(alert));
}

function thresholdAlert(input: {
  queue: string;
  code: string;
  message: string;
  value: number;
  warn: number;
  critical: number;
}): OpsAlert | null {
  if (input.value >= input.critical) {
    return {
      level: "critical",
      code: input.code,
      message: input.message,
      queue: input.queue,
      value: input.value,
      threshold: input.critical
    };
  }
  if (input.value >= input.warn) {
    return {
      level: "warn",
      code: input.code,
      message: input.message,
      queue: input.queue,
      value: input.value,
      threshold: input.warn
    };
  }
  return null;
}

function alertLevel(alerts: OpsAlert[]): OpsAlertLevel {
  if (alerts.some((alert) => alert.level === "critical")) return "critical";
  if (alerts.some((alert) => alert.level === "warn")) return "warn";
  return "ok";
}
