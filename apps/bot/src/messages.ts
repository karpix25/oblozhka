import { getFormatSpec, type WizardInput } from "@covers/domain";
export { supportMessage } from "./compliance.js";

export function startMessage(firstName?: string) {
  return [
    `Привет${firstName ? `, ${firstName}` : ""}.`,
    "",
    "Я превращаю ролик в готовую обложку: нахожу смысл, собираю сильный текст и применяю стиль из библиотеки.",
    "",
    "Можно дать ссылку, видео или текст ролика. Дальше ты выбираешь формат и шаблон, а я собираю композицию.",
    "",
    "Для старта доступно 3 пробные обложки."
  ].join("\n");
}

export function howItWorksMessage() {
  return [
    "Как это работает:",
    "",
    "1. Вы даёте ссылку, видео или текст ролика.",
    "2. Бот достаёт главную идею и готовит текст для обложки.",
    "3. Вы выбираете формат и шаблон.",
    "4. Загружаете фото, лицо или кадр-основу.",
    "5. Получаете готовый PNG.",
    "",
    "Референсы не копируются один-в-один: берём композицию, настроение и контраст."
  ].join("\n");
}

export function sourceStartMessage() {
  return [
    "Создадим обложку.",
    "",
    "С чего начнём?"
  ].join("\n");
}

export function sourcePrompt(kind: "LINK" | "VIDEO" | "TRANSCRIPT") {
  if (kind === "LINK") return "Отправьте ссылку на опубликованный ролик.";
  if (kind === "VIDEO") return "Загрузите видеофайл сюда. Я вытащу смысл и подготовлю текст для обложки.";
  return "Вставьте текст ролика. Чем подробнее текст, тем точнее получится обложка.";
}

export function platformPrompt() {
  return "Где будет использоваться обложка?";
}

export function templatePrompt() {
  return "Выберите механику обложки из библиотеки:";
}

export function referenceForGenerationPrompt() {
  return [
    "Текст для обложки выбран.",
    "",
    "Теперь нужна визуальная основа:",
    "— фото лица, если обложка с человеком;",
    "— кадр, скрин или референс, если без лица.",
    "",
    "От него я возьму лицо, позу или композицию и соберу картинку в выбранном стиле."
  ].join("\n");
}

export function termsMessage() {
  return [
    "Условия использования:",
    "1. Одна обложка списывает одну генерацию.",
    "2. Если генерация технически не удалась, баланс возвращается.",
    "3. Покупки цифровых услуг внутри Telegram оплачиваются Telegram Stars.",
    "4. Пользователь отвечает за законность использования итоговых изображений."
  ].join("\n");
}

export function confirmationMessage(input: WizardInput) {
  const spec = getFormatSpec(input.format);
  return [
    "Проверьте задачу перед генерацией:",
    "",
    `Режим: ${referenceLabel(input.referenceMode)}`,
    `Формат: ${spec.label} (${spec.aspectRatio})`,
    `Тема: ${input.topic}`,
    `Ниша: ${input.niche}`,
    `Стиль: ${input.style}`,
    `Текст: ${input.hookText || "без текста"}`,
    "",
    "После подтверждения отправлю задачу в генерацию."
  ].join("\n");
}

export function referencePrompt(mode: WizardInput["referenceMode"]) {
  if (mode === "FACE") {
    return "Шаг 1 из 5. Загрузите фото лица. Лучше: крупное лицо, хорошее освещение, без очков и сильных фильтров.";
  }
  return "Шаг 1 из 5. Загрузите референс обложки. Я возьму только настроение, композицию и контраст, не копируя дизайн.";
}

export function topicPrompt() {
  return "Шаг 3 из 5. Напишите тему или название ролика. Например: «Как я набрал 100к просмотров на Shorts».";
}

export function hookPrompt() {
  return "Шаг 5 из 5. Напишите короткий текст на обложке или отправьте «-», если текст не нужен.";
}

function referenceLabel(mode: WizardInput["referenceMode"]) {
  if (mode === "FACE") return "с моим фото";
  if (mode === "REFERENCE") return "по референсу";
  return "без фото";
}
