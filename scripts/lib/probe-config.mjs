const SMOKE_BASE_URL_ENV_NAMES = ["API_BASE_URL", "PRODUCTION_API_BASE_URL", "SMOKE_BASE_URL"];
const LOAD_BASE_URL_ENV_NAMES = ["API_BASE_URL", "PRODUCTION_API_BASE_URL", "LOAD_BASE_URL"];
const DEFAULT_LOAD_ENDPOINTS = "/health,/ready";

const BLOCKED_LOAD_ENDPOINT_PATTERNS = [
  /\/generations?\b/i,
  /\/hooks?\b/i,
  /\/telegram\/webhook\b/i,
  /\/payments?\b/i,
  /\/platega\b/i,
  /\/openrouter\b/i,
  /\/kie\b/i,
  /\/deepgram\b/i,
  /\/scrapecreators\b/i
];

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

export function readSmokeConfig(env = process.env) {
  return {
    baseUrl: readBaseUrl(env, SMOKE_BASE_URL_ENV_NAMES),
    adminToken: optionalString(env.ADMIN_TOKEN),
    timeoutMs: parsePositiveInteger(env.SMOKE_TIMEOUT_MS, {
      name: "SMOKE_TIMEOUT_MS",
      defaultValue: 5000,
      min: 1,
      max: 60000
    }),
    runPlategaAuthNegative: parseBooleanFlag(
      env.SMOKE_PLATEGA_CALLBACK ?? env.PRODUCTION_SMOKE_PLATEGA_CALLBACK,
      false,
      "SMOKE_PLATEGA_CALLBACK"
    ),
    plategaCallbackPath: parseEndpointPath(env.SMOKE_PLATEGA_CALLBACK_PATH ?? "/payments/platega/callback")
  };
}

export function readLoadConfig(env = process.env) {
  const durationMs = hasConfiguredValue(env.LOAD_DURATION_MS)
    ? parsePositiveInteger(env.LOAD_DURATION_MS, {
      name: "LOAD_DURATION_MS",
      min: 1000,
      max: 3600000
    })
    : secondsToMs(parsePositiveNumber(env.LOAD_DURATION_SECONDS ?? env.LOAD_DURATION, {
      name: "LOAD_DURATION_SECONDS",
      defaultValue: 30,
      min: 1,
      max: 3600
    }));

  return {
    baseUrl: readBaseUrl(env, LOAD_BASE_URL_ENV_NAMES),
    endpoints: parseEndpointList(env.LOAD_ENDPOINTS ?? DEFAULT_LOAD_ENDPOINTS),
    durationMs,
    concurrency: parsePositiveInteger(env.LOAD_CONCURRENCY, {
      name: "LOAD_CONCURRENCY",
      defaultValue: 4,
      min: 1,
      max: 500
    }),
    rps: parsePositiveNumber(env.LOAD_RPS, {
      name: "LOAD_RPS",
      defaultValue: 5,
      min: 0.1,
      max: 1000
    }),
    timeoutMs: parsePositiveInteger(env.LOAD_TIMEOUT_MS, {
      name: "LOAD_TIMEOUT_MS",
      defaultValue: 5000,
      min: 1,
      max: 60000
    }),
    maxErrorRate: parseErrorRate(env.LOAD_MAX_ERROR_RATE ?? "0"),
    maxP95Ms: parseOptionalPositiveInteger(env.LOAD_MAX_P95_MS, {
      name: "LOAD_MAX_P95_MS",
      min: 1,
      max: 3600000
    })
  };
}

export function parseEndpointList(value) {
  const endpoints = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseEndpointPath);

  if (endpoints.length === 0) {
    throw new ConfigError("LOAD_ENDPOINTS must include at least one endpoint path.");
  }

  for (const endpoint of endpoints) {
    if (isBlockedLoadEndpoint(endpoint)) {
      throw new ConfigError(`LOAD_ENDPOINTS includes a blocked expensive endpoint: ${endpoint}`);
    }
  }

  return [...new Set(endpoints)];
}

export function parseEndpointPath(value) {
  const path = String(value).trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ConfigError(`Endpoint path must start with one slash: ${value}`);
  }

  const url = new URL(path, "https://probe.local");
  if (url.hash) {
    throw new ConfigError(`Endpoint path must not include a URL hash: ${value}`);
  }

  return `${url.pathname}${url.search}`;
}

export function parseBooleanFlag(value, defaultValue, name = "boolean flag") {
  if (value == null || String(value).trim() === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  throw new ConfigError(`${name} must be true/false, 1/0, yes/no, or on/off.`);
}

export function parsePositiveInteger(value, options) {
  const numberValue = parsePositiveNumber(value, options);
  if (!Number.isInteger(numberValue)) {
    throw new ConfigError(`${options.name} must be an integer.`);
  }
  return numberValue;
}

export function parsePositiveNumber(value, options) {
  const raw = value == null || String(value).trim() === "" ? options.defaultValue : value;
  if (raw == null) {
    throw new ConfigError(`${options.name} is required.`);
  }

  const numberValue = Number(raw);
  if (!Number.isFinite(numberValue)) {
    throw new ConfigError(`${options.name} must be a finite number.`);
  }
  if (numberValue < options.min || numberValue > options.max) {
    throw new ConfigError(`${options.name} must be between ${options.min} and ${options.max}.`);
  }
  return numberValue;
}

export function parseErrorRate(value) {
  const raw = String(value).trim();
  const normalized = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new ConfigError("LOAD_MAX_ERROR_RATE must be a decimal from 0 to 1, or a percent like 1%.");
  }
  return normalized;
}

export function maskUrlForDisplay(value) {
  const url = new URL(value);
  if (url.username) url.username = "***";
  if (url.password) url.password = "***";
  for (const key of url.searchParams.keys()) {
    if (/token|secret|key|password/i.test(key)) {
      url.searchParams.set(key, "***");
    }
  }
  return url.toString().replace(/\/$/, "");
}

function readBaseUrl(env, names) {
  const value = firstConfiguredValue(env, names);
  if (!value) {
    throw new ConfigError(`${names.join(" or ")} is required.`);
  }

  const url = parseBaseUrl(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ConfigError("API base URL must use http or https.");
  }
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function firstConfiguredValue(env, names) {
  for (const name of names) {
    const value = optionalString(env[name]);
    if (value) return value;
  }
  return "";
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasConfiguredValue(value) {
  return value != null && String(value).trim() !== "";
}

function parseOptionalPositiveInteger(value, options) {
  if (value == null || String(value).trim() === "") return undefined;
  return parsePositiveInteger(value, options);
}

function secondsToMs(seconds) {
  return Math.round(seconds * 1000);
}

function isBlockedLoadEndpoint(endpoint) {
  return BLOCKED_LOAD_ENDPOINT_PATTERNS.some((pattern) => pattern.test(endpoint));
}

function parseBaseUrl(value) {
  try {
    return new URL(value);
  } catch {
    throw new ConfigError("API base URL must be a valid URL.");
  }
}
