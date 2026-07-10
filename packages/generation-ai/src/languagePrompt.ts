import type { ContentLanguage } from "./contentLanguage.js";
import { resolveVisualContentLanguage } from "./contentLanguage.js";
import type { PromptPlanningInput } from "./types.js";

export function promptContentLanguage(input: PromptPlanningInput) {
  return resolveVisualContentLanguage({
    contentLanguage: input.contentLanguage,
    hookText: input.wizard.hookText,
    topic: input.wizard.topic,
    niche: input.wizard.niche
  });
}

export function hookLanguageGuide(language: ContentLanguage) {
  if (language !== "ru") {
    return "Нужно 5 коротких русских hook-текстов для обложки. Первый хук должен быть лучшим вариантом для реальной генерации.";
  }
  return "Язык ролика — русский. Напиши все 5 hook-текстов только на русском языке, без английских слов и транслита. Первый хук должен быть лучшим вариантом для реальной генерации.";
}

export function visualLanguageGuide(language: ContentLanguage) {
  if (language !== "ru") {
    return "Сохрани язык выбранного текста на обложке. Не добавляй случайные подписи или псевдотекст.";
  }
  return "Язык ролика — русский. Весь видимый текст, подписи, бейджи, кнопки, таблички и декоративные слова на обложке должны быть только на русском языке. Не добавляй английские слова, транслит или псевдотекст.";
}

export function fallbackVisualLanguageRule(language: ContentLanguage) {
  if (language !== "ru") {
    return "Keep all visible typography in the source content language; do not add random labels or pseudo-text.";
  }
  return "The source video is in Russian. Render all visible text, labels, badges, buttons, signs and decorative words in Russian only. Do not add English words, transliteration or pseudo-text.";
}

export function requiresRussianVisualLanguage(input: PromptPlanningInput) {
  return promptContentLanguage(input) === "ru";
}
