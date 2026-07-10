import { renderProgressChecklist } from "./progressChecklist.js";

export type GenerationProgressStage =
  | "references"
  | "prompt"
  | "generation"
  | "processing"
  | "delivery"
  | "ready";

const GENERATION_PROGRESS_STEPS: Array<{ stage: GenerationProgressStage; label: string }> = [
  { stage: "references", label: "Подготавливаю лицо, стиль и дизайн-референсы" },
  { stage: "prompt", label: "Анализирую композицию и собираю prompt" },
  { stage: "generation", label: "Генерирую финальную обложку" },
  { stage: "processing", label: "Обрабатываю PNG и создаю превью" },
  { stage: "delivery", label: "Сохраняю и отправляю результат" },
  { stage: "ready", label: "Обложка готова" }
];

export function generationProgressText(stage: GenerationProgressStage) {
  return renderProgressChecklist({
    stage,
    completedStage: "ready",
    activeTitle: "⏳ Собираю обложку",
    completedTitle: "✅ Обложка готова",
    activeFooter: "Можно закрыть Telegram — это сообщение будет обновляться автоматически.",
    completedFooter: "Готовый файл отправлен отдельным сообщением.",
    steps: GENERATION_PROGRESS_STEPS
  });
}
