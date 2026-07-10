export type HookProgressStage = "source" | "generation" | "selection" | "ready";

const HOOK_PROGRESS_STEPS: Array<{ stage: HookProgressStage; label: string }> = [
  { stage: "source", label: "Изучаю источник и извлекаю содержание" },
  { stage: "generation", label: "Анализирую смысл и создаю CTR-варианты" },
  { stage: "selection", label: "Сравниваю варианты и выбираю лучший текст" },
  { stage: "ready", label: "Текст для обложки выбран" }
];

export function hookProgressText(stage: HookProgressStage) {
  const currentIndex = HOOK_PROGRESS_STEPS.findIndex((step) => step.stage === stage);
  const completed = stage === "ready";

  return [
    completed ? "✅ Текст для обложки готов" : "⏳ Подбираю текст для обложки",
    "",
    ...HOOK_PROGRESS_STEPS.map((step, index) => progressLine(step.label, index, currentIndex, completed)),
    "",
    completed
      ? "Следующий шаг отправлен отдельным сообщением."
      : "Можно закрыть Telegram — это сообщение будет обновляться автоматически."
  ].join("\n");
}

function progressLine(label: string, index: number, currentIndex: number, completed: boolean) {
  if (completed || index < currentIndex) return `✅ ${index + 1}. ${label}`;
  if (index === currentIndex) return `⏳ ${index + 1}. ${label}`;
  return `▫️ ${index + 1}. ${label}`;
}
