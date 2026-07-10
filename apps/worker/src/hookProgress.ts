import { renderProgressChecklist } from "./progressChecklist.js";

export type HookProgressStage = "source" | "generation" | "selection" | "ready";

const HOOK_PROGRESS_STEPS: Array<{ stage: HookProgressStage; label: string }> = [
  { stage: "source", label: "Изучаю источник и извлекаю содержание" },
  { stage: "generation", label: "Анализирую смысл и создаю CTR-варианты" },
  { stage: "selection", label: "Сравниваю варианты и выбираю лучший текст" },
  { stage: "ready", label: "Текст для обложки выбран" }
];

export function hookProgressText(stage: HookProgressStage) {
  return renderProgressChecklist({
    stage,
    completedStage: "ready",
    activeTitle: "⏳ Подбираю текст для обложки",
    completedTitle: "✅ Текст для обложки готов",
    activeFooter: "Можно закрыть Telegram — это сообщение будет обновляться автоматически.",
    completedFooter: "Следующий шаг отправлен отдельным сообщением.",
    steps: HOOK_PROGRESS_STEPS
  });
}
