import {
  INITIAL_PROGRESS_DOT_FRAME,
  renderAnimatedStatus,
  type ProgressDotFrame
} from "./animatedStatus.js";

export type HookProgressStage = "source" | "generation" | "selection" | "ready";

const HOOK_PROGRESS_LABELS: Record<Exclude<HookProgressStage, "ready">, string> = {
  source: "Изучаю источник и извлекаю содержание",
  generation: "Анализирую смысл и создаю варианты текста",
  selection: "Сравниваю варианты и выбираю лучший текст"
};

export function hookProgressText(
  stage: HookProgressStage,
  frame: ProgressDotFrame = INITIAL_PROGRESS_DOT_FRAME
) {
  if (stage === "ready") return "✅ Текст для обложки готов.";
  return renderAnimatedStatus(HOOK_PROGRESS_LABELS[stage], frame);
}
