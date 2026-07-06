export function summarizeSamples(samples) {
  const durations = samples
    .map((sample) => sample.durationMs)
    .filter((duration) => Number.isFinite(duration))
    .sort((left, right) => left - right);
  const requests = samples.length;
  const errors = samples.filter((sample) => !sample.ok).length;

  return {
    requests,
    ok: requests - errors,
    errors,
    errorRate: requests === 0 ? 1 : errors / requests,
    p50: percentileSorted(durations, 50),
    p95: percentileSorted(durations, 95),
    p99: percentileSorted(durations, 99)
  };
}

export function summarizeByEndpoint(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    const current = grouped.get(sample.endpoint) ?? [];
    current.push(sample);
    grouped.set(sample.endpoint, current);
  }

  return [...grouped.entries()].map(([endpoint, endpointSamples]) => ({
    endpoint,
    ...summarizeSamples(endpointSamples)
  }));
}

export function percentile(values, rank) {
  const sorted = [...values].sort((left, right) => left - right);
  return percentileSorted(sorted, rank);
}

export function evaluateLoadSummary(summary, thresholds) {
  const issues = [];
  if (summary.requests === 0) {
    issues.push("no requests were completed");
  }
  if (summary.errorRate > thresholds.maxErrorRate) {
    issues.push(`error rate ${formatPercent(summary.errorRate)} exceeded ${formatPercent(thresholds.maxErrorRate)}`);
  }
  if (thresholds.maxP95Ms != null && summary.p95 != null && summary.p95 > thresholds.maxP95Ms) {
    issues.push(`p95 ${formatMs(summary.p95)} exceeded ${formatMs(thresholds.maxP95Ms)}`);
  }
  return issues;
}

export function formatMs(value) {
  return value == null ? "n/a" : `${Math.round(value)}ms`;
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`;
}

function percentileSorted(sortedValues, rank) {
  if (sortedValues.length === 0) return null;
  const boundedRank = Math.min(100, Math.max(0, rank));
  const index = Math.max(0, Math.ceil((boundedRank / 100) * sortedValues.length) - 1);
  return sortedValues[Math.min(index, sortedValues.length - 1)];
}
