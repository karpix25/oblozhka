import { countHookWords, normalizeHookText } from "./hookText.js";
import type { HookCandidate, HookContext } from "./hookTypes.js";

const DEFAULT_MAX_WORDS = 5;

export function buildFallbackHooks(context: HookContext, maxWords = DEFAULT_MAX_WORDS): HookCandidate[] {
  const keywords = context.keywords;
  const primary = keywords[0] ?? extractThemeFallback(context.theme) ?? extractTranscriptFallback(context.transcript);
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
