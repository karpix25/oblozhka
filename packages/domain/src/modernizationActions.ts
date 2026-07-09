import { minPlanForFeature, planHasFeature, type PaidPlan, type PlanFeature } from "./plans.js";

export type ModernizationActionId =
  | "stronger_hook"
  | "more_contrast"
  | "clean_layout"
  | "new_expression"
  | "fresh_style"
  | "ai_filter";

export type ModernizationAction = {
  id: ModernizationActionId;
  label: string;
  queuedLabel: string;
  requiredFeature: PlanFeature;
  promptInstruction: string;
};

export const MODERNIZATION_ACTIONS: ModernizationAction[] = [
  {
    id: "stronger_hook",
    label: "🔥 Усилить текст",
    queuedLabel: "усилю текст и драму",
    requiredFeature: "AI_EDITING",
    promptInstruction: "Make the cover text more provocative, shorter and more clickable while keeping it truthful."
  },
  {
    id: "more_contrast",
    label: "🎨 Больше контраста",
    queuedLabel: "усилю контраст и читаемость",
    requiredFeature: "AI_EDITING",
    promptInstruction: "Increase contrast, separation, color punch and small-screen readability without making the design noisy."
  },
  {
    id: "clean_layout",
    label: "✨ Почистить дизайн",
    queuedLabel: "сделаю дизайн чище",
    requiredFeature: "AI_EDITING",
    promptInstruction: "Clean up the layout, reduce clutter, improve spacing and keep one clear focal subject."
  },
  {
    id: "new_expression",
    label: "😮 Другая эмоция",
    queuedLabel: "поменяю эмоцию лица",
    requiredFeature: "FACE_EXPRESSIONS",
    promptInstruction: "Change the main face expression to a stronger emotion that fits the hook, while preserving identity."
  },
  {
    id: "fresh_style",
    label: "🔁 Повторить стиль",
    queuedLabel: "сделаю свежий стиль",
    requiredFeature: "REPLICATE_TEMPLATE",
    promptInstruction: "Create a fresh stylistic variation of the same thumbnail idea while preserving the topic and main message."
  },
  {
    id: "ai_filter",
    label: "🎛 AI-фильтр",
    queuedLabel: "применю AI-фильтр",
    requiredFeature: "AI_FILTERS",
    promptInstruction: "Apply a more cinematic AI filter treatment while keeping the thumbnail readable and commercially useful."
  }
];

export function getModernizationAction(id: string): ModernizationAction | undefined {
  return MODERNIZATION_ACTIONS.find((action) => action.id === id);
}

export function canUseModernizationAction(plan: PaidPlan | null | undefined, action: ModernizationAction) {
  return Boolean(plan && planHasFeature(plan, action.requiredFeature));
}

export function modernizationActionLabel(action: ModernizationAction, plan: PaidPlan | null | undefined) {
  if (canUseModernizationAction(plan, action)) {
    return action.label;
  }
  return `${action.label} ⭐ ${planBadge(minPlanForFeature(action.requiredFeature))}`;
}

export function modernizationActionLockedMessage(action: ModernizationAction) {
  const minPlan = minPlanForFeature(action.requiredFeature);
  return [
    `Функция «${action.label.replace(/^[^А-Яа-яA-Za-z]+\s*/, "")}» доступна на тарифе ${planBadge(minPlan)}.`,
    "",
    "Кнопка видна заранее, чтобы было понятно, что можно открыть на следующем тарифе."
  ].join("\n");
}

function planBadge(plan: PaidPlan) {
  if (plan === "PRO") return "Pro";
  if (plan === "BUSINESS") return "Business";
  return "Start";
}
