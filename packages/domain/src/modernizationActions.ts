export type ModernizationActionId =
  | "stronger_hook"
  | "more_contrast"
  | "clean_layout"
  | "new_expression"
  | "fresh_style";

export type ModernizationAction = {
  id: ModernizationActionId;
  label: string;
  queuedLabel: string;
  promptInstruction: string;
};

export const MODERNIZATION_ACTIONS: ModernizationAction[] = [
  {
    id: "stronger_hook",
    label: "🔥 Усилить текст",
    queuedLabel: "усилю текст и драму",
    promptInstruction: "Make the cover text more provocative, shorter and more clickable while keeping it truthful."
  },
  {
    id: "more_contrast",
    label: "🎨 Больше контраста",
    queuedLabel: "усилю контраст и читаемость",
    promptInstruction: "Increase contrast, separation, color punch and small-screen readability without making the design noisy."
  },
  {
    id: "clean_layout",
    label: "✨ Почистить дизайн",
    queuedLabel: "сделаю дизайн чище",
    promptInstruction: "Clean up the layout, reduce clutter, improve spacing and keep one clear focal subject."
  },
  {
    id: "new_expression",
    label: "😮 Другая эмоция",
    queuedLabel: "поменяю эмоцию лица",
    promptInstruction: "Change the main face expression to a stronger emotion that fits the hook, while preserving identity."
  },
  {
    id: "fresh_style",
    label: "🔁 Новый стиль",
    queuedLabel: "сделаю свежий стиль",
    promptInstruction: "Create a fresh stylistic variation of the same thumbnail idea while preserving the topic and main message."
  }
];

export function getModernizationAction(id: string): ModernizationAction | undefined {
  return MODERNIZATION_ACTIONS.find((action) => action.id === id);
}
