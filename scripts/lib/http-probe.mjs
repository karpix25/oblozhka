import { performance } from "node:perf_hooks";

export async function fetchProbe({ baseUrl, path, method = "GET", headers = {}, body, timeoutMs }) {
  const url = buildProbeUrl(baseUrl, path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      durationMs: performance.now() - startedAt,
      text,
      json: parseJson(text),
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: performance.now() - startedAt,
      text: "",
      json: null,
      error: describeFetchError(error, timeoutMs)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildProbeUrl(baseUrl, path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase).toString();
}

function parseJson(text) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function describeFetchError(error, timeoutMs) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `timeout after ${timeoutMs}ms`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "request failed";
}
