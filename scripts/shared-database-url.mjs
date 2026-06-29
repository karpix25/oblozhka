export function buildDatabaseUrl(env) {
  const user = encodeURIComponent(env.POSTGRES_USER || "postgres");
  const password = encodeURIComponent(env.POSTGRES_PASSWORD || "postgres");
  const host = env.POSTGRES_HOST || "postgres";
  const port = env.POSTGRES_PORT || "5432";
  const database = encodeURIComponent(env.POSTGRES_DB || "covers");

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

export function maskDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "postgresql://***";
  }
}
