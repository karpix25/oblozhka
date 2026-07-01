const QUOTE_EDGE_PATTERN = /^[\s"'`«»“”‘’]+|[\s"'`«»“”‘’]+$/g;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:[-–][\p{L}\p{N}]+)*/gu;

export function normalizeHookText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(QUOTE_EDGE_PATTERN, "")
    .trim();
}

export function hookFingerprint(text: string): string {
  return normalizeHookText(text)
    .toLocaleLowerCase("ru")
    .replace(/[!?.,:;()[\]{}"'`«»“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countHookWords(text: string): number {
  return normalizeHookText(text).match(WORD_PATTERN)?.length ?? 0;
}

export function deriveMaxHookWords(templateRules?: string): number | undefined {
  if (!templateRules?.trim()) return undefined;

  const rules = templateRules.toLocaleLowerCase("ru");
  const patterns = [
    /(?:до|максимум|max|не больше|не более)\s*(\d{1,2})\s*(?:слов|слова|words?)/u,
    /(?:words?|слов|слова)\D{0,8}(?:до|максимум|max|не больше|не более)\s*(\d{1,2})/u,
    /(?:<=|≤)\s*(\d{1,2})\s*(?:слов|слова|words?)/u,
    /\b\d{1,2}\s*[-–]\s*(\d{1,2})\s*(?:слов|слова|words?)\b/u
  ];

  for (const pattern of patterns) {
    const match = rules.match(pattern);
    const value = match?.[1] ? Number.parseInt(match[1], 10) : undefined;
    if (value && value > 0) return value;
  }

  return undefined;
}
