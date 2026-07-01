import { countHookWords, hookFingerprint, normalizeHookText } from "./hookText.js";
import type { HookCandidate, HookContext } from "./hookTypes.js";

const GENERIC_FINGERPRINTS = new Set([
  "я не ожидал",
  "так нельзя",
  "вот что сработало",
  "все изменилось",
  "всё изменилось",
  "это важно",
  "главная ошибка",
  "секрет успеха",
  "никто не знает",
  "ты должен знать",
  "смотри до конца"
]);

const GENERIC_PATTERNS = [
  /^(шок|срочно|важно|жесть|правда)$/u,
  /^(это|вот)\s+(важно|шок|правда)$/u,
  /^(главный|главная|главное)\s+(секрет|ошибка|правило)$/u
];

export function normalizeAndRankHooks(
  hooks: HookCandidate[],
  options: { context: HookContext; maxWords?: number; limit?: number }
): HookCandidate[] {
  const seen = new Set<string>();
  const scored: Array<HookCandidate & { rankScore: number }> = [];

  for (const hook of hooks) {
    const text = normalizeHookText(hook.text);
    const fingerprint = hookFingerprint(text);
    if (!text || !fingerprint || seen.has(fingerprint)) continue;
    if (isGenericHook(fingerprint)) continue;
    if (options.maxWords && countHookWords(text) > options.maxWords) continue;

    seen.add(fingerprint);
    scored.push({
      text,
      angle: hook.angle,
      score: hook.score,
      rankScore: rankHook(text, hook.score ?? 0, options.context)
    });
  }

  return scored
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, options.limit ?? 5)
    .map(({ rankScore: _rankScore, ...hook }) => hook);
}

function isGenericHook(fingerprint: string): boolean {
  if (GENERIC_FINGERPRINTS.has(fingerprint)) return true;
  return GENERIC_PATTERNS.some((pattern) => pattern.test(fingerprint));
}

function rankHook(text: string, modelScore: number, context: HookContext): number {
  const lower = text.toLocaleLowerCase("ru");
  const numberBonus = /\d/.test(text) ? 18 : 0;
  const keywordMatches = context.keywords.filter((keyword) => lower.includes(keyword)).length;
  const transcriptNumberMatches = context.numbers.filter((number) => lower.includes(number)).length;

  return modelScore + numberBonus + keywordMatches * 9 + transcriptNumberMatches * 12;
}
