import { getFormatSpec, type WizardInput } from "@covers/domain";

export function buildCoverPrompt(input: WizardInput): string {
  const format = getFormatSpec(input.format);
  const hook = input.hookText?.trim()
    ? `Крупный читаемый текст на обложке: "${input.hookText.trim()}".`
    : "Без лишнего текста, только если он усиливает кликабельность.";

  return [
    `Создай ${format.description} в формате ${format.aspectRatio}.`,
    `Тема видео: ${input.topic.trim()}.`,
    `Ниша: ${input.niche}.`,
    `Стиль: ${input.style}.`,
    hook,
    "Цель: высокая кликабельность, понятная эмоция, сильный фокусный объект.",
    "Композиция должна работать в маленьком превью YouTube/Shorts.",
    "Избегай водяных знаков, логотипов платформ, лишнего мелкого текста и артефактов.",
    "Если есть текст, он должен быть на русском, крупный, контрастный и без ошибок."
  ].join("\n");
}
