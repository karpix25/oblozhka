export function renderProgressChecklist<TStage extends string>(input: {
  stage: TStage;
  completedStage: TStage;
  activeTitle: string;
  completedTitle: string;
  activeFooter: string;
  completedFooter: string;
  steps: ReadonlyArray<{ stage: TStage; label: string }>;
}) {
  const currentIndex = input.steps.findIndex((step) => step.stage === input.stage);
  const completed = input.stage === input.completedStage;

  return [
    completed ? input.completedTitle : input.activeTitle,
    "",
    ...input.steps.map((step, index) => progressLine(step.label, index, currentIndex, completed)),
    "",
    completed ? input.completedFooter : input.activeFooter
  ].join("\n");
}

function progressLine(label: string, index: number, currentIndex: number, completed: boolean) {
  if (completed || index < currentIndex) return `✅ ${index + 1}. ${label}`;
  if (index === currentIndex) return `⏳ ${index + 1}. ${label}`;
  return `▫️ ${index + 1}. ${label}`;
}
