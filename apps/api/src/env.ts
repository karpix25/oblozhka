type Env = NodeJS.ProcessEnv;

type EnvRequirement = {
  name: string;
  allowPlaceholder?: boolean;
};

const PLACEHOLDER_VALUES = new Set(["change-me", "changeme", "replace-me", "todo", "example", "secret", "password"]);

const PRODUCTION_REQUIREMENTS: EnvRequirement[] = [
  { name: "ADMIN_TOKEN" },
  { name: "BOT_TOKEN" },
  { name: "DATABASE_URL", allowPlaceholder: true },
  { name: "REDIS_URL", allowPlaceholder: true },
  { name: "PLATEGA_BASE_URL", allowPlaceholder: true },
  { name: "PLATEGA_MERCHANT_ID" },
  { name: "PLATEGA_SECRET" },
  { name: "PAYMENT_RETURN_URL", allowPlaceholder: true },
  { name: "KIE_API_KEY" },
  { name: "KIE_BASE_URL", allowPlaceholder: true },
  { name: "KIE_IMAGE_MODEL", allowPlaceholder: true },
  { name: "OPENROUTER_API_KEY" },
  { name: "OPENROUTER_MODEL", allowPlaceholder: true },
  { name: "SCRAPECREATORS_API_KEY" },
  { name: "SCRAPECREATORS_BASE_URL", allowPlaceholder: true },
  { name: "DEEPGRAM_API_KEY" },
  { name: "DEEPGRAM_MODEL", allowPlaceholder: true },
  { name: "S3_ENDPOINT", allowPlaceholder: true },
  { name: "S3_REGION", allowPlaceholder: true },
  { name: "S3_BUCKET" },
  { name: "S3_ACCESS_KEY_ID" },
  { name: "S3_SECRET_ACCESS_KEY" },
  { name: "S3_PUBLIC_BASE_URL", allowPlaceholder: true }
];

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid production environment:\n- ${issues.join("\n- ")}`);
    this.name = "EnvValidationError";
  }
}

export function validateProductionEnv(env: Env = process.env) {
  const issues = collectProductionEnvIssues(env);
  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }
}

export function collectProductionEnvIssues(env: Env) {
  if (!isProductionRuntime(env)) {
    return [];
  }

  return PRODUCTION_REQUIREMENTS.flatMap((requirement) => validateRequirement(env, requirement));
}

export function isProductionRuntime(env: Env) {
  const appEnv = normalized(env.APP_ENV ?? env.DEPLOY_ENV);
  if (appEnv) {
    return appEnv === "production";
  }

  return normalized(env.NODE_ENV) === "production";
}

export function isPlaceholderSecret(value: string) {
  const cleanValue = normalized(value);
  return !cleanValue || PLACEHOLDER_VALUES.has(cleanValue);
}

function validateRequirement(env: Env, requirement: EnvRequirement) {
  const value = env[requirement.name]?.trim();
  if (!value) {
    return [`${requirement.name} is required in production.`];
  }

  if (!requirement.allowPlaceholder && isPlaceholderSecret(value)) {
    return [`${requirement.name} must be set to a real production secret, not a placeholder.`];
  }

  return [];
}

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase();
}
