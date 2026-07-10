const BUILTIN_SUPERADMIN_TELEGRAM_IDS = new Set(["38061745"]);

export function isSuperadminTelegramId(
  telegramId: bigint | number | string,
  env: NodeJS.ProcessEnv = process.env
) {
  return readSuperadminTelegramIds(env).has(String(telegramId));
}

export function readSuperadminTelegramIds(env: NodeJS.ProcessEnv = process.env) {
  const configuredIds = (env.SUPERADMIN_TELEGRAM_IDS ?? "")
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value));

  return new Set([...BUILTIN_SUPERADMIN_TELEGRAM_IDS, ...configuredIds]);
}
