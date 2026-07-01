const TEMPLATE_RU_TITLES: Record<string, string> = {
  podcast: "Подкаст",
  "center-stage": "Эксперт в кадре",
  "podcast-countdown": "Подкаст с дедлайном",
  "simple-text": "Кино-титр",
  whiteboard: "Доска с разбором",
  "text-on-image": "Большой текст поверх фото",
  history: "Две реальности",
  explainer: "Карточка с цифрой",
  "object-in-hand": "Предмет в руках",
  "contextual-background": "Сюжетный фон",
  "before-after": "До/после",
  "multi-pov": "Мульти-POV",
  notifications: "Уведомления",
  "brain-rot-podcast": "Подкаст Brain Rot",
  "gaming-card": "Игровая карточка",
  "story-cards": "Карточки историй",
  "floating-proof": "Доказательство с цифрой",
  educational: "Обучающий график",
  "faceless-pov": "POV без лица",
  "foreground-focus": "Объект на первом плане",
  "center-object-text": "Объект в центре",
  "split-compare": "Сравнение до/после"
};

export function templateDisplayName(slug: string, fallbackTitle: string) {
  return TEMPLATE_RU_TITLES[slug] ?? fallbackTitle;
}
