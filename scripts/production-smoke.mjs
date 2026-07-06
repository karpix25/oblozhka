#!/usr/bin/env node
import { ConfigError, maskUrlForDisplay, readSmokeConfig } from "./lib/probe-config.mjs";
import { fetchProbe } from "./lib/http-probe.mjs";
import { formatMs } from "./lib/load-stats.mjs";

let config;
try {
  config = readSmokeConfig();
} catch (error) {
  printConfigError(error);
  process.exit(1);
}

const checks = [];

checks.push(await runJsonOkCheck({
  name: "health",
  path: "/health",
  expectedStatus: 200
}));

checks.push(await runJsonOkCheck({
  name: "ready",
  path: "/ready",
  expectedStatus: 200
}));

checks.push(await runQueuesStatusCheck());

if (config.runPlategaAuthNegative) {
  checks.push(await runPlategaAuthNegativeCheck());
}

printReport(checks);

if (checks.some((check) => check.critical && !check.pass)) {
  process.exit(1);
}

async function runJsonOkCheck({ name, path, expectedStatus }) {
  const response = await fetchProbe({
    baseUrl: config.baseUrl,
    path,
    timeoutMs: config.timeoutMs
  });

  const jsonOk = response.json && response.json.ok === true;
  return {
    name,
    path,
    critical: true,
    pass: response.status === expectedStatus && jsonOk,
    status: response.status,
    durationMs: response.durationMs,
    detail: response.error || failureDetail(response, expectedStatus, "json ok=true")
  };
}

async function runQueuesStatusCheck() {
  if (!config.adminToken) {
    return {
      name: "queues/status",
      path: "/queues/status",
      critical: true,
      pass: false,
      status: 0,
      durationMs: 0,
      detail: "ADMIN_TOKEN is required for protected queue status smoke"
    };
  }

  const response = await fetchProbe({
    baseUrl: config.baseUrl,
    path: "/queues/status",
    headers: {
      Authorization: `Bearer ${config.adminToken}`
    },
    timeoutMs: config.timeoutMs
  });

  const jsonOk = response.json && response.json.ok === true;
  return {
    name: "queues/status",
    path: "/queues/status",
    critical: true,
    pass: response.status === 200 && jsonOk,
    status: response.status,
    durationMs: response.durationMs,
    detail: response.error || failureDetail(response, 200, "json ok=true")
  };
}

async function runPlategaAuthNegativeCheck() {
  const response = await fetchProbe({
    baseUrl: config.baseUrl,
    path: config.plategaCallbackPath,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MerchantId": "smoke-invalid-merchant",
      "X-Secret": "smoke-invalid-secret"
    },
    body: JSON.stringify({
      id: `smoke-auth-negative-${Date.now()}`,
      status: "CONFIRMED",
      amount: 1,
      currency: "RUB"
    }),
    timeoutMs: config.timeoutMs
  });

  return {
    name: "platega auth-negative",
    path: config.plategaCallbackPath,
    critical: true,
    pass: response.status === 401,
    status: response.status,
    durationMs: response.durationMs,
    detail: response.error || failureDetail(response, 401, "invalid callback credentials rejected")
  };
}

function printReport(results) {
  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;

  console.log(`production-smoke: base=${maskUrlForDisplay(config.baseUrl)} checks=${results.length}`);
  for (const result of results) {
    const label = result.pass ? "PASS" : "FAIL";
    const status = result.status === 0 ? "ERR" : result.status;
    const suffix = result.pass ? "" : ` - ${result.detail}`;
    console.log(`${label} ${result.name} status=${status} time=${formatMs(result.durationMs)}${suffix}`);
  }
  console.log(`summary: passed=${passed} failed=${failed} critical_failed=${results.filter((result) => result.critical && !result.pass).length}`);
}

function failureDetail(response, expectedStatus, expectedBody) {
  if (response.status === 0) return response.error || "request failed";
  const bodyHint = expectedBody ? ` and ${expectedBody}` : "";
  return `expected status ${expectedStatus}${bodyHint}, got ${response.status}`;
}

function printConfigError(error) {
  if (error instanceof ConfigError) {
    console.error(`production-smoke: config error: ${error.message}`);
    return;
  }
  throw error;
}
