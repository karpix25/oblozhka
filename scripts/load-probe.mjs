#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { ConfigError, maskUrlForDisplay, readLoadConfig } from "./lib/probe-config.mjs";
import { fetchProbe } from "./lib/http-probe.mjs";
import {
  evaluateLoadSummary,
  formatMs,
  formatPercent,
  summarizeByEndpoint,
  summarizeSamples
} from "./lib/load-stats.mjs";

let config;
try {
  config = readLoadConfig();
} catch (error) {
  printConfigError(error);
  process.exit(1);
}

console.log(
  `load-probe: base=${maskUrlForDisplay(config.baseUrl)} duration=${formatSeconds(config.durationMs)} ` +
  `concurrency=${config.concurrency} rps=${config.rps} endpoints=${config.endpoints.join(",")}`
);

const { samples, elapsedMs } = await runLoadProbe(config);
const summary = summarizeSamples(samples);
const issues = evaluateLoadSummary(summary, {
  maxErrorRate: config.maxErrorRate,
  maxP95Ms: config.maxP95Ms
});

printSummary("all", summary, elapsedMs);
for (const endpointSummary of summarizeByEndpoint(samples)) {
  printSummary(endpointSummary.endpoint, endpointSummary);
}

if (issues.length > 0) {
  console.error(`load-probe: failed - ${issues.join("; ")}`);
  process.exit(1);
}

async function runLoadProbe(loadConfig) {
  const samples = [];
  const inFlight = new Set();
  const startedAt = performance.now();
  const stopAt = startedAt + loadConfig.durationMs;
  const intervalMs = 1000 / loadConfig.rps;
  let nextLaunchAt = startedAt;
  let launched = 0;

  while (performance.now() < stopAt || inFlight.size > 0) {
    const now = performance.now();
    if (now < stopAt && now >= nextLaunchAt && inFlight.size < loadConfig.concurrency) {
      const endpoint = loadConfig.endpoints[launched % loadConfig.endpoints.length];
      launched += 1;
      const request = runOneRequest(loadConfig, endpoint, samples).catch((error) => {
        samples.push({
          endpoint,
          ok: false,
          status: 0,
          durationMs: 0,
          error: error instanceof Error ? error.message : "request failed"
        });
      });
      inFlight.add(request);
      request.finally(() => inFlight.delete(request));
      nextLaunchAt = Math.max(nextLaunchAt + intervalMs, performance.now() + intervalMs);
    }

    if (performance.now() >= stopAt && inFlight.size === 0) break;
    await sleep(nextDelayMs(nextLaunchAt, inFlight.size, loadConfig.concurrency));
  }

  return {
    samples,
    elapsedMs: performance.now() - startedAt
  };
}

async function runOneRequest(loadConfig, endpoint, samples) {
  const response = await fetchProbe({
    baseUrl: loadConfig.baseUrl,
    path: endpoint,
    timeoutMs: loadConfig.timeoutMs
  });
  samples.push({
    endpoint,
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
    error: response.error
  });
}

function printSummary(label, summary, elapsedMs) {
  const elapsed = elapsedMs == null ? "" : ` elapsed=${formatSeconds(elapsedMs)}`;
  console.log(
    `${label}: requests=${summary.requests} ok=${summary.ok} errors=${summary.errors} ` +
    `error_rate=${formatPercent(summary.errorRate)} p50=${formatMs(summary.p50)} ` +
    `p95=${formatMs(summary.p95)} p99=${formatMs(summary.p99)}${elapsed}`
  );
}

function nextDelayMs(nextLaunchAt, inFlightCount, concurrency) {
  if (inFlightCount >= concurrency) return 10;
  const delay = nextLaunchAt - performance.now();
  return Math.max(1, Math.min(delay, 50));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
}

function printConfigError(error) {
  if (error instanceof ConfigError) {
    console.error(`load-probe: config error: ${error.message}`);
    return;
  }
  throw error;
}
