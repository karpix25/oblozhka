import { getFormatSpec, type WizardInput } from "@covers/domain";

export function startMessage(firstName?: string) {
  return [
    `Привет${firstName ? `, ${firstName}` : ""}.`,
    "",
    "Соберём обложку для YouTube или vertical-видео без долгого дизайна: фото, тема, стиль — и готовый PNG.",
    "",
    "Лучший первый сценарий: загрузи своё фото, напиши тему ролика, выбери стиль. Я сам соберу промпт и композицию.",
    "",
    "С чего начнём?"
  ].join("\n");
}

export function howItWorksMessage() {
  return [
    "Как это работает:",
    "",
    "1. Вы даёте ссылку, видео или транскрипт.",
    "2. Бот достаёт смысл ролика и готовит CTR-хуки.",
    "3. Вы выбираете платформу и шаблон обложки.",
    "4. Вы выбираете хук.",
    "5. Kie.ai генерирует обложку через gpt-image-2-image-to-image.",
    "",
    "Референсы не копируются один-в-один: берём только композицию, настроение и контраст."
  ].join("\n");
}

export function sourceStartMessage() {
  return [
    "Создадим проект для обложки.",
    "",
    "Что у тебя есть?"
  ].join("\n");
}

export function sourcePrompt(kind: "LINK" | "VIDEO" | "TRANSCRIPT") {
  if (kind === "LINK") return "Отправьте ссылку на опубликованный ролик.";
  if (kind === "VIDEO") return "Загрузите видеофайл сюда. Если Telegram сожмёт видео — это нормально для MVP.";
  return "Вставьте текст транскрибации. Чем подробнее текст, тем лучше будут хуки.";
}

export function platformPrompt() {
  return "Куда делаем обложку?";
}

export function templatePrompt() {
  return "Выберите механику обложки из библиотеки:";
}

export function referenceForGenerationPrompt() {
  return [
    "Хук выбран.",
    "",
    "Теперь загрузите визуальную основу для генерации:",
    "— своё фото, если обложка с лицом;",
    "— скрин/референс/кадр, если faceless.",
    "",
    "Это нужно, потому что текущая Kie-модель работает в режиме image-to-image."
  ].join("\n");
}

export function supportMessage() {
  return "Поддержка: напишите владельцу проекта. Команда /paysupport доступна для вопросов по оплатам.";
}

export function termsMessage() {
  return [
    "Условия использования:",
    "1. Кредиты списываются за каждую отправленную генерацию.",
    "2. Если генерация технически не удалась, кредит возвращается.",
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
    "Сейчас генерация в тестовом режиме, без списания кредитов."
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
