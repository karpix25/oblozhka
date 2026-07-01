import type { HookContext } from "./hookTypes.js";

const NUMBER_PATTERN = /\b\d+(?:[.,]\d+)?%?\b/gu;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const STOP_WORDS = new Set([
  "без", "благодаря", "был", "была", "были", "вам", "вас", "все", "всё", "где", "для",
  "его", "если", "еще", "ещё", "как", "или", "кто", "мне", "мой", "мы", "над", "нас",
  "нее", "него", "них", "она", "они", "оно", "под", "получил", "получила", "после",
  "при", "про", "раз", "сам", "себя", "так", "там", "тем", "то", "уже", "что", "это",
  "этот", "этого", "этой", "the", "and", "for", "you"
]);

export function buildHookContext(input: { transcript: string; theme?: string }): HookContext {
  const source = [input.theme, input.transcript].filter(Boolean).join("\n");

  return {
    transcript: input.transcript,
    theme: input.theme,
    keywords: extractKeywords(source),
    numbers: uniqueMatches(source, NUMBER_PATTERN).slice(0, 5)
  };
}

function extractKeywords(source: string): string[] {
  const counts = new Map<string, number>();
  const original = source.match(TOKEN_PATTERN) ?? [];

  for (const token of original) {
    const normalized = token.toLocaleLowerCase("ru");
    if (normalized.length < 4 || STOP_WORDS.has(normalized) || /^\d+$/.test(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .slice(0, 12);
}

function uniqueMatches(source: string, pattern: RegExp): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const match of source.match(pattern) ?? []) {
    if (seen.has(match)) continue;
    seen.add(match);
    values.push(match);
  }

  return values;
}
