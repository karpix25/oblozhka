import { countHookWords, normalizeHookText } from "./hookText.js";
import type { HookCandidate, HookContext } from "./hookTypes.js";
import { isRussianOnlyText, type ContentLanguage } from "./contentLanguage.js";

const DEFAULT_MAX_WORDS = 5;
const WEAK_KEYWORDS = new Set([
  "есть", "один", "очень", "когда", "который", "можно", "нужно", "свои", "свой",
  "своё", "будет", "через", "только", "также", "после", "этого"
]);

type FallbackHookDraft = {
  text: string;
  angle: string;
};

export function buildFallbackHooks(
  context: HookContext,
  maxWords = DEFAULT_MAX_WORDS,
  contentLanguage: ContentLanguage = "other"
): HookCandidate[] {
  const requireRussian = contentLanguage === "ru";
  const maxHookWords = Math.max(2, maxWords);
  const keywords = (requireRussian ? context.keywords.filter(isRussianOnlyText) : context.keywords)
    .filter(isUsefulKeyword);
  const theme = requireRussian && !isRussianOnlyText(context.theme ?? "") ? undefined : context.theme;
  const transcript = requireRussian ? russianTranscriptText(context.transcript) : context.transcript;
  const primary = keywords[0] ?? extractThemeFallback(theme) ?? extractTranscriptFallback(transcript);
  const secondary = keywords.find((keyword) => keyword !== primary) ?? "разбор";
  const hooks = selectFallbackHooks([
    ...contextualHookDrafts(transcript),
    ...genericHookDrafts(primary, secondary)
  ], maxHookWords);

  return hooks.map((hook, index) => ({
    text: hook.text.toLocaleUpperCase("ru"),
    angle: hook.angle,
    score: 70 - index * 5
  }));
}

function russianTranscriptText(transcript: string) {
  return transcript.match(/[А-Яа-яЁё]+/g)?.join(" ") ?? "тема ролика";
}

function contextualHookDrafts(transcript: string): FallbackHookDraft[] {
  const lower = transcript.toLocaleLowerCase("ru");
  const drafts: FallbackHookDraft[] = [];

  if (lower.includes("взломан") && lower.includes("интернет")) {
    drafts.push({ text: "взломанный интернет", angle: "object_proof" });
  }
  if (/wi-?fi|вай-?фай|слежк/u.test(lower)) {
    drafts.push({ text: "скрытая слежка", angle: "stakes" });
  }
  if (lower.includes("один человек") || lower.includes("один разработ")) {
    drafts.push({ text: "один разработчик", angle: "counterintuitive" });
  }
  if (lower.includes("обратную сторону")) {
    drafts.push({ text: "обратная сторона", angle: "hidden_reason" });
  }
  if (lower.includes("искусственн") || lower.includes("интеллект")) {
    drafts.push({ text: "ии в кибераналитике", angle: "specific_result" });
  }

  return drafts;
}

function genericHookDrafts(primary: string, secondary: string): FallbackHookDraft[] {
  return [
    { text: `${primary} ${secondary}`, angle: "object_proof" },
    { text: "скрытая ошибка", angle: "mistake_cost" },
    { text: "скрытая причина", angle: "hidden_reason" },
    { text: `${primary} наоборот`, angle: "counterintuitive" },
    { text: "новый результат", angle: "specific_result" },
    { text: "главный риск", angle: "stakes" },
    { text: `${primary} без потерь`, angle: "stakes" },
    { text: `${primary} против ${secondary}`, angle: "visual_pair" },
    { text: "две стороны", angle: "visual_pair" }
  ];
}

function selectFallbackHooks(drafts: FallbackHookDraft[], maxWords: number): FallbackHookDraft[] {
  const selected: FallbackHookDraft[] = [];
  const seenText = new Set<string>();
  const seenAngles = new Set<string>();

  for (const draft of drafts.map(normalizeDraft)) {
    if (!isValidFallbackDraft(draft, maxWords) || seenText.has(draft.text)) continue;
    if (!seenAngles.has(draft.angle)) {
      selected.push(draft);
      seenText.add(draft.text);
      seenAngles.add(draft.angle);
    }
  }

  for (const draft of drafts.map(normalizeDraft)) {
    if (!isValidFallbackDraft(draft, maxWords) || seenText.has(draft.text)) continue;
    selected.push(draft);
    seenText.add(draft.text);
  }

  return selected;
}

function normalizeDraft(draft: FallbackHookDraft): FallbackHookDraft {
  return {
    ...draft,
    text: normalizeHookText(draft.text).toLocaleLowerCase("ru")
  };
}

function isValidFallbackDraft(draft: FallbackHookDraft, maxWords: number): boolean {
  const wordCount = countHookWords(draft.text);
  return (
    wordCount >= 2 &&
    wordCount <= maxWords &&
    !/\b(?:13\s+в|есть)\b/iu.test(draft.text) &&
    !hasAwkwardInflectedPair(draft.text)
  );
}

function isUsefulKeyword(keyword: string): boolean {
  const normalized = keyword.toLocaleLowerCase("ru");
  return normalized.length >= 4 && !WEAK_KEYWORDS.has(normalized) && !/^\d+$/.test(normalized);
}

function hasAwkwardInflectedPair(text: string): boolean {
  const words = text.toLocaleLowerCase("ru").split(/\s+/);
  return words.length <= 2 && words.some((word) => /(?:ими|ыми|ого|его|ему)$/u.test(word));
}

function extractThemeFallback(theme?: string): string | undefined {
  const token = theme?.match(/[\p{L}\p{N}]{4,}/u)?.[0];
  return token?.toLocaleLowerCase("ru");
}

function extractTranscriptFallback(transcript: string): string {
  const token = transcript.match(/[\p{L}\p{N}]{4,}/u)?.[0];
  return token?.toLocaleLowerCase("ru") ?? "тема ролика";
}
