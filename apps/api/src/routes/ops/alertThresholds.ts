export type OpsAlertThresholds = {
  queueBacklogWarn: number;
  queueBacklogCritical: number;
  queueOldestJobWarnMs: number;
  queueOldestJobCriticalMs: number;
  queueFailedWarn: number;
  queueFailedCritical: number;
};

export const DEFAULT_OPS_ALERT_THRESHOLDS: OpsAlertThresholds = {
  queueBacklogWarn: 20,
  queueBacklogCritical: 100,
  queueOldestJobWarnMs: 5 * 60 * 1000,
  queueOldestJobCriticalMs: 15 * 60 * 1000,
  queueFailedWarn: 1,
  queueFailedCritical: 10
};

export function readOpsAlertThresholds(env: NodeJS.ProcessEnv = process.env): OpsAlertThresholds {
  return {
    queueBacklogWarn: positiveIntegerEnv(env, "OPS_QUEUE_BACKLOG_WARN", DEFAULT_OPS_ALERT_THRESHOLDS.queueBacklogWarn),
    queueBacklogCritical: positiveIntegerEnv(env, "OPS_QUEUE_BACKLOG_CRITICAL", DEFAULT_OPS_ALERT_THRESHOLDS.queueBacklogCritical),
    queueOldestJobWarnMs: positiveIntegerEnv(env, "OPS_QUEUE_OLDEST_JOB_WARN_MS", DEFAULT_OPS_ALERT_THRESHOLDS.queueOldestJobWarnMs),
    queueOldestJobCriticalMs: positiveIntegerEnv(
      env,
      "OPS_QUEUE_OLDEST_JOB_CRITICAL_MS",
      DEFAULT_OPS_ALERT_THRESHOLDS.queueOldestJobCriticalMs
    ),
    queueFailedWarn: positiveIntegerEnv(env, "OPS_QUEUE_FAILED_WARN", DEFAULT_OPS_ALERT_THRESHOLDS.queueFailedWarn),
    queueFailedCritical: positiveIntegerEnv(env, "OPS_QUEUE_FAILED_CRITICAL", DEFAULT_OPS_ALERT_THRESHOLDS.queueFailedCritical)
  };
}

function positiveIntegerEnv(env: NodeJS.ProcessEnv, name: string, fallback: number) {
  const parsed = Number(env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
