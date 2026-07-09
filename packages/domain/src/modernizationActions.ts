import { minPlanForFeature, planHasFeature, type PaidPlan, type PlanFeature } from "./plans.js";

export type ModernizationActionId =
  | "custom_edit"
  | "replicate_template";

export type ModernizationAction = {
  id: ModernizationActionId;
  label: string;
  queuedLabel: string;
  requiredFeature: PlanFeature;
  promptInstruction: string;
};

export const MODERNIZATION_ACTIONS: ModernizationAction[] = [
  {
    id: "custom_edit",
    label: "✍️ Описать правку",
    queuedLabel: "внесу вашу правку",
    requiredFeature: "AI_EDITING",
    promptInstruction: "Apply the user's requested edit to the finished thumbnail while preserving the useful parts of the original image."
  },
  {
    id: "replicate_template",
    label: "🔁 Повторить шаблон",
    queuedLabel: "повторю шаблон референса",
    requiredFeature: "REPLICATE_TEMPLATE",
    promptInstruction: "Use the uploaded reference as a template guide for future original thumbnails without copying protected text, logos, faces or brands."
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
