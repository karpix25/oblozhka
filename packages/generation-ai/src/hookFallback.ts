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
    { text: number ? `${number} ошибка в ${primary}` : `ошибка в ${primary}`, angle: "mistake_cost" },
    { text: `${primary}: скрытая причина`, angle: "hidden_reason" },
    { text: `${primary} работает наоборот`, angle: "counterintuitive" },
    { text: number ? `${number} в ${primary}` : `${primary} без потерь`, angle: number ? "object_proof" : "stakes" },
    { text: `${primary} против ${secondary}`, angle: "visual_pair" }
  ];

  return hooks.map((hook, index) => ({
    text: fitHookText(hook.text, maxWords).toLocaleUpperCase("ru"),
    angle: hook.angle,
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
