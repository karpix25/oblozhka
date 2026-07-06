import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOpsAlerts } from "../apps/api/src/routes/ops/alerts.js";
import { collectProcessMetrics, toQueueMetric } from "../apps/api/src/routes/ops/metrics.js";

test("process metrics expose bounded numeric memory snapshot", () => {
  const metrics = collectProcessMetrics(
    {
      rss: 10,
      heapTotal: 20,
      heapUsed: 12,
      external: 4,
      arrayBuffers: 2
    },
    12.7
  );

  assert.deepEqual(metrics, {
    uptimeSeconds: 13,
    memory: {
      rssBytes: 10,
      heapTotalBytes: 20,
      heapUsedBytes: 12,
      externalBytes: 4,
      arrayBuffersBytes: 2
    }
  });
});

test("queue metrics summarize backlog and oldest age", () => {
  assert.deepEqual(
    toQueueMetric({
      name: "cover-generation",
      counts: { waiting: 3, active: 1, delayed: 2, failed: 1 },
      oldestJob: {
        id: "job-1",
        state: "waiting",
        ageMs: 1500,
        timestamp: "2026-07-06T12:00:00.000Z"
      }
    }),
    {
      name: "cover-generation",
      waiting: 3,
      active: 1,
      delayed: 2,
      failed: 1,
      backlog: 5,
      oldestJobAgeMs: 1500
    }
  );
});

test("ops alerts escalate queue thresholds", () => {
  const alerts = evaluateOpsAlerts(
    {
      ok: true,
      timestamp: "2026-07-06T12:00:00.000Z",
      process: collectProcessMetrics(),
      queues: [
        {
          name: "cover-generation",
          waiting: 12,
          active: 2,
          delayed: 1,
          failed: 4,
          backlog: 13,
          oldestJobAgeMs: 7000
        }
      ]
    },
    {
      queueBacklogWarn: 10,
      queueBacklogCritical: 20,
      queueOldestJobWarnMs: 5000,
      queueOldestJobCriticalMs: 10000,
      queueFailedWarn: 1,
      queueFailedCritical: 3
    }
  );

  assert.deepEqual(
    alerts.map((alert) => [alert.level, alert.code, alert.value, alert.threshold]),
    [
      ["warn", "queue_backlog_high", 13, 10],
      ["critical", "queue_failed_high", 4, 3],
      ["warn", "queue_oldest_job_stale", 7000, 5000]
    ]
  );
});
