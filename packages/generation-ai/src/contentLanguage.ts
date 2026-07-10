export type ContentLanguage = "ru" | "other";

const LETTER_PATTERN = /\p{L}/gu;
const RUSSIAN_LETTER_PATTERN = /[А-Яа-яЁё]/g;
const UNKNOWN_LANGUAGE_CODES = new Set(["", "auto", "und", "unknown"]);

export function detectContentLanguage(text: string): ContentLanguage {
  const letters = text.match(LETTER_PATTERN) ?? [];
  const russianLetters = text.match(RUSSIAN_LETTER_PATTERN) ?? [];
  if (russianLetters.length < 3 || letters.length === 0) return "other";
  return russianLetters.length / letters.length >= 0.3 ? "ru" : "other";
}

export function resolveContentLanguage(language: string | null | undefined, text: string): ContentLanguage {
  const normalized = language?.trim().toLocaleLowerCase("ru") ?? "";
  if (normalized === "ru" || normalized === "rus" || normalized.startsWith("ru-")) return "ru";
  if (normalized.includes("russian") || normalized.includes("рус")) return "ru";
  if (!UNKNOWN_LANGUAGE_CODES.has(normalized)) return "other";
  return detectContentLanguage(text);
}

export function resolveVisualContentLanguage(input: {
  contentLanguage?: ContentLanguage;
  hookText?: string;
  topic?: string;
  niche?: string;
}) {
  return resolveContentLanguage(
    input.contentLanguage,
    [input.hookText, input.topic, input.niche].filter(Boolean).join("\n")
  );
}

export function isRussianOnlyText(text: string) {
  const letters = text.match(LETTER_PATTERN) ?? [];
  const russianLetters = text.match(RUSSIAN_LETTER_PATTERN) ?? [];
  return letters.length > 0 && russianLetters.length === letters.length;
}
