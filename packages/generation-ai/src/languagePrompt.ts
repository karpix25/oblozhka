import type { ContentLanguage } from "./contentLanguage.js";
import { resolveVisualContentLanguage } from "./contentLanguage.js";
import type { PromptPlanningInput } from "./types.js";

export const RUSSIAN_VISUAL_LANGUAGE_POLICY =
  "Render every visible text element in Russian only: main headline, labels, badges, buttons, signs, charts, stickers, UI fragments, product labels and decorative words. Do not add English words, Latin letters, transliteration, pseudo-text or gibberish.";

export const RUSSIAN_VISUAL_LANGUAGE_POLICY_RU =
  "Весь видимый текст на обложке должен быть только на русском языке: главный заголовок, подписи, бейджи, кнопки, таблички, графики, стикеры, UI-элементы, надписи на товарах и декоративные слова. Не добавляй английские слова, латиницу, транслит, псевдотекст или бессмысленные буквы.";

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
  return `Язык ролика — русский. ${RUSSIAN_VISUAL_LANGUAGE_POLICY_RU}`;
}

export function fallbackVisualLanguageRule(language: ContentLanguage) {
  if (language !== "ru") {
    return "Keep all visible typography in the source content language; do not add random labels or pseudo-text.";
  }
  return `The source video is in Russian. ${RUSSIAN_VISUAL_LANGUAGE_POLICY}`;
}

export function requiresRussianVisualLanguage(input: PromptPlanningInput) {
  return promptContentLanguage(input) === "ru";
}
