import {
  INITIAL_PROGRESS_DOT_FRAME,
  renderAnimatedStatus,
  type ProgressDotFrame
} from "./animatedStatus.js";

export type GenerationProgressStage =
  | "references"
  | "prompt"
  | "generation"
  | "processing"
  | "delivery"
  | "ready";

const GENERATION_PROGRESS_LABELS: Record<Exclude<GenerationProgressStage, "ready">, string> = {
  references: "Подготавливаю лицо, стиль и дизайн-референсы",
  prompt: "Анализирую композицию и собираю промпт",
  generation: "Генерирую финальную обложку",
  processing: "Обрабатываю PNG и создаю превью",
  delivery: "Сохраняю и отправляю результат"
};

export function generationProgressText(
  stage: GenerationProgressStage,
  frame: ProgressDotFrame = INITIAL_PROGRESS_DOT_FRAME
) {
  if (stage === "ready") return "✅ Обложка готова.";
  return renderAnimatedStatus(GENERATION_PROGRESS_LABELS[stage], frame);
}
