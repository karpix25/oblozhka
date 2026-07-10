import type { ContentLanguage } from "./contentLanguage.js";
import { countHookWords, hookFingerprint, normalizeHookText } from "./hookText.js";
import type { HookCandidate, HookContext } from "./hookTypes.js";

const DEFAULT_MIN_WORDS = 2;
const DEFAULT_MAX_WORDS = 5;
const DEFAULT_MAX_CHARACTERS = 36;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const LATIN_PATTERN = /[A-Za-z]/;
const PUNCTUATION_PATTERN = /[!?.,:;()[\]{}"'`«»“”‘’—–-]/g;
const REPEATED_PUNCTUATION_PATTERN = /([!?.,:;])\1+/;

const STOP_WORDS = new Set([
  "без", "был", "была", "были", "вам", "вас", "все", "всё", "для", "его", "если",
  "еще", "ещё", "как", "или", "кто", "мне", "мой", "над", "нас", "она", "они",
  "оно", "под", "при", "про", "сам", "так", "там", "тем", "что", "это", "этот",
  "the", "and", "are", "for", "from", "how", "that", "this", "with", "you", "your"
]);

const GENERIC_CLICKBAIT = [
  /^(я\s+)?не\s+ожидал[аи]?$/u,
  /^так\s+нельзя$/u,
  /^(все|всё)\s+изменилось$/u,
  /^это\s+важно$/u,
  /^смотри\s+до\s+конца$/u,
  /^никто\s+не\s+знает$/u,
  /^секрет\s+успеха$/u,
  /^(главная|главный|главное)\s+ошибка$/u,
  /^(шок|срочно|важно|жесть|правда)$/u,
  /^(you\s+won'?t\s+believe|watch\s+until\s+the\s+end|this\s+changes\s+everything)$/u
];

const MEANINGLESS_SINGLE_WORDS = new Set([
  "важно", "жесть", "правда", "секрет", "срочно", "шок", "это", "wow"
]);

const TENSION_PATTERN =
  /(ошиб|потер|провал|риск|ловуш|скрыт|обман|дорог|нельзя|проблем|против|vs|почему|не\s+работает|mistake|risk|hidden|failure|versus|why)/iu;
const CURIOSITY_PATTERN =
  /(что\s+изменил|что\s+скрыва|причин|вместо|до\s+и\s+после|реальность|оказал|result|reason|behind|instead|before|after)/iu;
const SPECIFIC_OBJECT_PATTERN = /[\p{L}]{6,}/u;

export type ThumbnailHookBreakdown = {
  relevance: number;
  curiosityTension: number;
  specificity: number;
  readability: number;
  titleSynergy: number;
};

export type ThumbnailHookQualityOptions = {
  context: HookContext;
  contentLanguage: ContentLanguage;
  sourceTitle?: string;
  minWords?: number;
  maxWords?: number;
  maxCharacters?: number;
};

export type ThumbnailHookEvaluation = {
  accepted: boolean;
  hook: HookCandidate;
  fingerprint: string;
  score: number;
  breakdown: ThumbnailHookBreakdown;
  reasons: string[];
  modelTieBreak: number;
};

export function evaluateThumbnailHook(
  candidate: HookCandidate,
  options: ThumbnailHookQualityOptions
): ThumbnailHookEvaluation {
  const text = normalizeHookText(candidate.text ?? "");
  const fingerprint = hookFingerprint(text);
  const wordCount = countHookWords(text);
  const minWords = options.minWords ?? DEFAULT_MIN_WORDS;
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const reasons: string[] = [];

  if (!text || !fingerprint) reasons.push("empty");
  if (wordCount < minWords) reasons.push("too_few_words");
  if (wordCount > maxWords) reasons.push("too_many_words");
  if (options.contentLanguage === "ru" && LATIN_PATTERN.test(text)) reasons.push("latin_in_russian_hook");
  if (isGenericClickbait(fingerprint)) reasons.push("generic_clickbait");
  if (wordCount === 1 && isMeaninglessSingleWord(fingerprint, options.context)) {
    reasons.push("meaningless_single_word");
  }
  if (isNearSourceRepeat(text, [options.sourceTitle, options.context.theme])) {
    reasons.push("near_source_repeat");
  }

  const breakdown = scoreBreakdown(text, options);
  const score = clampScore(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const hook = { ...candidate, text, score };

  return {
    accepted: reasons.length === 0,
    hook,
    fingerprint,
    score,
    breakdown,
    reasons,
    modelTieBreak: clamp(candidate.score ?? 0, 0, 100) * 0.03
  };
}

export function rankThumbnailHooks(
  candidates: HookCandidate[],
  options: ThumbnailHookQualityOptions & { limit?: number }
): HookCandidate[] {
  const ranked = new Map<string, RankedHook>();

  candidates.forEach((candidate, index) => {
    const evaluation = evaluateThumbnailHook(candidate, options);
    if (!evaluation.accepted || !evaluation.fingerprint) return;

    const item = { evaluation, index };
    const current = ranked.get(evaluation.fingerprint);
    if (!current || compareRanked(item, current) < 0) {
      ranked.set(evaluation.fingerprint, item);
    }
  });

  const ordered = [...ranked.values()].sort(compareRanked);
  const selected = selectWithAngleDiversity(ordered, options.limit ?? 5);
  return selected.map(({ evaluation }) => evaluation.hook);
}

type RankedHook = {
  evaluation: ThumbnailHookEvaluation;
  index: number;
};

function scoreBreakdown(
  text: string,
  options: ThumbnailHookQualityOptions
): ThumbnailHookBreakdown {
  const hookTokens = significantTokens(text);
  const contextTokens = new Set([
    ...options.context.keywords.flatMap(significantTokens),
    ...significantTokens(options.context.transcript)
  ]);
  const sourceTokens = new Set(
    significantTokens([options.sourceTitle, options.context.theme].filter(Boolean).join(" "))
  );
  const keywordMatches = countMatches(hookTokens, new Set(options.context.keywords.flatMap(significantTokens)));
  const contextMatches = countMatches(hookTokens, contextTokens);
  const numberMatches = options.context.numbers.filter((number) => text.includes(number)).length;
  const hasNumber = /\d/.test(text);

  const relevance = clamp(
    contextMatches * 4 + keywordMatches * 3 + numberMatches * 5,
    0,
    25
  );
  const curiosityTension = clamp(
    (TENSION_PATTERN.test(text) ? 10 : 0) +
      (CURIOSITY_PATTERN.test(text) ? 7 : 0) +
      (/[?:]/.test(text) ? 3 : 0),
    0,
    20
  );
  const specificity = clamp(
    (numberMatches > 0 ? 9 : hasNumber ? 6 : 0) +
      Math.min(7, keywordMatches * 4) +
      (hookTokens.some((token) => SPECIFIC_OBJECT_PATTERN.test(token)) ? 4 : 0),
    0,
    20
  );
  const readability = scoreReadability(text, options);
  const titleSynergy = scoreTitleSynergy(hookTokens, sourceTokens, relevance);

  return { relevance, curiosityTension, specificity, readability, titleSynergy };
}

function scoreReadability(text: string, options: ThumbnailHookQualityOptions): number {
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const punctuationCount = text.match(PUNCTUATION_PATTERN)?.length ?? 0;
  let score = 20;

  if (text.length > maxCharacters) score -= Math.ceil((text.length - maxCharacters) / 2);
  if (punctuationCount > 2) score -= (punctuationCount - 2) * 2;
  if (REPEATED_PUNCTUATION_PATTERN.test(text)) score -= 4;
  if (countHookWords(text) === 5) score -= 1;

  return clamp(score, 0, 20);
}

function scoreTitleSynergy(
  hookTokens: string[],
  sourceTokens: Set<string>,
  relevance: number
): number {
  if (sourceTokens.size === 0) return clamp(7 + Math.round(relevance / 4), 0, 15);

  const overlap = countMatches(hookTokens, sourceTokens);
  const overlapRatio = overlap / Math.max(1, hookTokens.length);
  const novelTokens = hookTokens.length - overlap;
  return clamp(
    (overlapRatio > 0 && overlapRatio < 0.8 ? 7 : overlapRatio === 0 ? 3 : 1) +
      Math.min(5, novelTokens * 2) +
      (relevance >= 12 ? 3 : 0),
    0,
    15
  );
}

function isNearSourceRepeat(text: string, sources: Array<string | undefined>): boolean {
  const hookTokens = significantTokens(text);
  if (hookTokens.length === 0) return false;

  return sources.some((source) => {
    const sourceTokens = new Set(significantTokens(source ?? ""));
    if (sourceTokens.size === 0) return false;
    const overlap = countMatches(hookTokens, sourceTokens);
    return overlap / hookTokens.length >= 0.8 && overlap / sourceTokens.size >= 0.65;
  });
}

function significantTokens(text: string): string[] {
  return (hookFingerprint(text).match(TOKEN_PATTERN) ?? [])
    .map((token) => token.toLocaleLowerCase("ru"))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function countMatches(tokens: string[], reference: Set<string>): number {
  const referenceTokens = [...reference];
  return new Set(
    tokens.filter((token) => referenceTokens.some((candidate) => tokensMatch(token, candidate)))
  ).size;
}

function tokensMatch(left: string, right: string): boolean {
  if (left === right) return true;
  if (!/[А-Яа-яЁё]/u.test(left) || !/[А-Яа-яЁё]/u.test(right)) return false;
  return russianTokenStem(left) === russianTokenStem(right);
}

function russianTokenStem(token: string): string {
  return token.replace(/(?:иями|ями|ами|ого|ему|ими|ыми|ов|ев|ам|ям|ах|ях|ой|ей|ом|ем|ы|и|а|я|у|ю|е)$/u, "");
}

function isGenericClickbait(fingerprint: string): boolean {
  return GENERIC_CLICKBAIT.some((pattern) => pattern.test(fingerprint));
}

function isMeaninglessSingleWord(fingerprint: string, context: HookContext): boolean {
  if (MEANINGLESS_SINGLE_WORDS.has(fingerprint)) return true;
  if (/\d/.test(fingerprint)) return false;
  return !context.keywords.some((keyword) => hookFingerprint(keyword) === fingerprint);
}

function compareRanked(left: RankedHook, right: RankedHook): number {
  return (
    right.evaluation.score - left.evaluation.score ||
    right.evaluation.modelTieBreak - left.evaluation.modelTieBreak ||
    (left.evaluation.hook.angle ?? "").localeCompare(right.evaluation.hook.angle ?? "", "ru") ||
    left.evaluation.hook.text.localeCompare(right.evaluation.hook.text, "ru") ||
    left.index - right.index
  );
}

function selectWithAngleDiversity(ranked: RankedHook[], limit: number): RankedHook[] {
  if (limit <= 0 || ranked.length === 0) return [];

  const selected = [ranked[0]];
  const selectedItems = new Set(selected);
  const seenAngles = new Set(selected.map(angleKey).filter(Boolean));

  for (const item of ranked.slice(1)) {
    const angle = angleKey(item);
    if (selected.length >= limit) break;
    if (!angle || seenAngles.has(angle)) continue;
    selected.push(item);
    selectedItems.add(item);
    seenAngles.add(angle);
  }

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (!selectedItems.has(item)) selected.push(item);
  }

  return selected;
}

function angleKey(item: RankedHook): string {
  return item.evaluation.hook.angle?.trim().toLocaleLowerCase("ru") ?? "";
}

function clampScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
