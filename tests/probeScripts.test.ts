import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBooleanFlag,
  parseEndpointList,
  parseErrorRate,
  readLoadConfig
} from "../scripts/lib/probe-config.mjs";
import { evaluateLoadSummary, percentile, summarizeSamples } from "../scripts/lib/load-stats.mjs";

test("load config parses safe endpoints and numeric thresholds", () => {
  const config = readLoadConfig({
    LOAD_BASE_URL: "https://api.example.com/",
    LOAD_ENDPOINTS: "/health, /ready?deep=1",
    LOAD_DURATION_SECONDS: "2",
    LOAD_CONCURRENCY: "3",
    LOAD_RPS: "7.5",
    LOAD_TIMEOUT_MS: "1500",
    LOAD_MAX_ERROR_RATE: "1%",
    LOAD_MAX_P95_MS: "900"
  });

  assert.equal(config.baseUrl, "https://api.example.com");
  assert.deepEqual(config.endpoints, ["/health", "/ready?deep=1"]);
  assert.equal(config.durationMs, 2000);
  assert.equal(config.concurrency, 3);
  assert.equal(config.rps, 7.5);
  assert.equal(config.timeoutMs, 1500);
  assert.equal(config.maxErrorRate, 0.01);
  assert.equal(config.maxP95Ms, 900);
});

test("load endpoint parsing blocks expensive production paths", () => {
  assert.throws(
    () => parseEndpointList("/health,/admin/generations"),
    /blocked expensive endpoint/
  );
  assert.throws(
    () => parseEndpointList("https://api.example.com/health"),
    /must start with one slash/
  );
});

test("probe parsing rejects invalid booleans and accepts percent error rates", () => {
  assert.equal(parseBooleanFlag("yes", false, "FLAG"), true);
  assert.equal(parseBooleanFlag("", true, "FLAG"), true);
  assert.equal(parseErrorRate("0.025"), 0.025);
  assert.equal(parseErrorRate("2.5%"), 0.025);
  assert.throws(() => parseBooleanFlag("maybe", false, "FLAG"), /FLAG must be/);
});

test("load stats calculate nearest-rank percentiles and threshold issues", () => {
  const summary = summarizeSamples([
    { ok: true, durationMs: 10 },
    { ok: true, durationMs: 20 },
    { ok: false, durationMs: 30 },
    { ok: true, durationMs: 40 }
  ]);

  assert.equal(percentile([40, 10, 30, 20], 50), 20);
  assert.equal(summary.requests, 4);
  assert.equal(summary.errors, 1);
  assert.equal(summary.errorRate, 0.25);
  assert.equal(summary.p95, 40);
  assert.deepEqual(evaluateLoadSummary(summary, { maxErrorRate: 0.1, maxP95Ms: 35 }), [
    "error rate 25.0% exceeded 10.0%",
    "p95 40ms exceeded 35ms"
  ]);
});
