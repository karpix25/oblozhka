import { countHookWords, normalizeHookText } from "./hookText.js";
import type { HookCandidate, HookContext } from "./hookTypes.js";
import { isRussianOnlyText, type ContentLanguage } from "./contentLanguage.js";

const DEFAULT_MAX_WORDS = 5;

export function buildFallbackHooks(
  context: HookContext,
  maxWords = DEFAULT_MAX_WORDS,
  contentLanguage: ContentLanguage = "other"
): HookCandidate[] {
  const requireRussian = contentLanguage === "ru";
  const keywords = requireRussian ? context.keywords.filter(isRussianOnlyText) : context.keywords;
  const theme = requireRussian && !isRussianOnlyText(context.theme ?? "") ? undefined : context.theme;
  const transcript = requireRussian ? russianTranscriptText(context.transcript) : context.transcript;
  const primary = keywords[0] ?? extractThemeFallback(theme) ?? extractTranscriptFallback(transcript);
  const secondary = keywords.find((keyword) => keyword !== primary) ?? "разбор";
  const number = context.numbers[0];
  const hooks = [
    number ? `${number} ошибка в ${primary}` : `ошибка в ${primary}`,
    `почему ${primary} не работает`,
    `${primary}: скрытая причина`,
    `${primary} без потерь`,
    `${primary} против ${secondary}`
  ];

  return hooks.map((text, index) => ({
    text: fitHookText(text, maxWords).toLocaleUpperCase("ru"),
    angle: ["specific", "reason", "mistake", "analysis", "contrast"][index],
    score: 70 - index * 5
  }));
}

function russianTranscriptText(transcript: string) {
  return transcript.match(/[А-Яа-яЁё]+/g)?.join(" ") ?? "тема ролика";
}

function fitHookText(text: string, maxWords: number): string {
  const normalized = normalizeHookText(text);
  if (countHookWords(normalized) <= maxWords) return normalized;
  return normalized.split(/\s+/).slice(0, maxWords).join(" ");
}

function extractThemeFallback(theme?: string): string | undefined {
  const token = theme?.match(/[\p{L}\p{N}]{4,}/u)?.[0];
  return token?.toLocaleLowerCase("ru");
}

function extractTranscriptFallback(transcript: string): string {
  const token = transcript.match(/[\p{L}\p{N}]{4,}/u)?.[0];
  return token?.toLocaleLowerCase("ru") ?? "тема ролика";
}
