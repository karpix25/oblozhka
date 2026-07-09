export function toTelegramPhotoUrl(value: string): string | null {
  if (isTelegramBotFileUrl(value)) {
    return null;
  }

  if (isHttpUrl(value)) {
    return value;
  }

  const s3Key = parseS3Key(value);
  if (!s3Key) {
    return null;
  }

  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) {
    return null;
  }

  return `${publicBaseUrl.replace(/\/$/, "")}/${s3Key}`;
}

function isHttpUrl(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function isTelegramBotFileUrl(value: string) {
  return value.startsWith("https://api.telegram.org/file/bot") || value.startsWith("http://api.telegram.org/file/bot");
}

function parseS3Key(value: string) {
  if (!value.startsWith("s3://")) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.pathname.replace(/^\//, "") || null;
  } catch {
    return null;
  }
}
