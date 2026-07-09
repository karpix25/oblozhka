export type PaidPlan = "START" | "PRO" | "BUSINESS";

export type PlanFeature =
  | "AI_EDITING"
  | "STYLE_COPY"
  | "CUSTOM_STYLE_UPLOAD"
  | "REPLICATE_TEMPLATE"
  | "FAST_GENERATION_2X"
  | "FAST_GENERATION_4X"
  | "AI_FILTERS"
  | "FACE_EXPRESSIONS"
  | "PRIORITY_SUPPORT"
  | "PRIORITY_QUEUE";

export type PlanConfig = {
  code: PaidPlan;
  title: string;
  description: string;
  monthlyCredits: number | null;
  avatarLimit: number | null;
  queuePriority: number;
  features: PlanFeature[];
  defaultPriceRub: number;
};

export const TRIAL_CREDITS = 3;
export const BILLING_PERIOD_DAYS = 30;

export const PLAN_CONFIGS: Record<PaidPlan, PlanConfig> = {
  START: {
    code: "START",
    title: "Старт",
    description: "100 кредитов в месяц, 1 аватар, AI-правки и генерации без водяного знака.",
    monthlyCredits: 100,
    avatarLimit: 1,
    queuePriority: 30,
    features: ["AI_EDITING"],
    defaultPriceRub: 1490
  },
  PRO: {
    code: "PRO",
    title: "Про",
    description: "500 кредитов в месяц, до 10 аватаров, AI-правки, копирование стиля и ускоренная генерация.",
    monthlyCredits: 500,
    avatarLimit: 10,
    queuePriority: 10,
    features: ["AI_EDITING", "STYLE_COPY", "CUSTOM_STYLE_UPLOAD", "REPLICATE_TEMPLATE", "FAST_GENERATION_2X", "PRIORITY_QUEUE"],
    defaultPriceRub: 3990
  },
  BUSINESS: {
    code: "BUSINESS",
    title: "Бизнес",
    description: "Безлимитные кредиты, аватары без жесткого лимита, AI-фильтры, эмоции лица и максимальный приоритет.",
    monthlyCredits: null,
    avatarLimit: null,
    queuePriority: 1,
    features: [
      "AI_EDITING",
      "STYLE_COPY",
      "CUSTOM_STYLE_UPLOAD",
      "REPLICATE_TEMPLATE",
      "FAST_GENERATION_4X",
      "AI_FILTERS",
      "FACE_EXPRESSIONS",
      "PRIORITY_SUPPORT",
      "PRIORITY_QUEUE"
    ],
    defaultPriceRub: 9900
  }
};

export const PAID_PLAN_ORDER: PaidPlan[] = ["START", "PRO", "BUSINESS"];

export function getPlanConfig(plan: PaidPlan): PlanConfig {
  return PLAN_CONFIGS[plan];
}

export function isUnlimitedPlan(plan: PaidPlan): boolean {
  return PLAN_CONFIGS[plan].monthlyCredits === null;
}

export function planHasFeature(plan: PaidPlan, feature: PlanFeature): boolean {
  return PLAN_CONFIGS[plan].features.includes(feature);
}

export function minPlanForFeature(feature: PlanFeature): PaidPlan {
  const plan = PAID_PLAN_ORDER.find((candidate) => planHasFeature(candidate, feature));
  if (!plan) {
    throw new Error(`Feature ${feature} is not available in any paid plan`);
  }
  return plan;
}
