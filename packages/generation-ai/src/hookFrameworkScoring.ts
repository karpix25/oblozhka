import {
  isThumbnailHookFramework,
  type ThumbnailHookFramework
} from "./hookFrameworks.js";

const FRAMEWORK_ALIASES: Record<string, ThumbnailHookFramework> = {
  analysis: "hidden_reason",
  contrast: "visual_pair",
  contrarian: "counterintuitive",
  curiosity: "hidden_reason",
  metric: "specific_result",
  mistake: "mistake_cost",
  reason: "hidden_reason",
  result: "specific_result",
  specificity: "object_proof",
  transformation: "visual_pair"
};

const FRAMEWORK_SIGNALS: Record<ThumbnailHookFramework, readonly RegExp[]> = {
  mistake_cost: [
    /(ошиб|провал|сломал|съеда|стоил|потер|дорог|mistake|failure|cost)/iu
  ],
  hidden_reason: [
    /(скрыт|причин|почему|из-за|меша|не\s+работает|reason|hidden|why)/iu
  ],
  counterintuitive: [
    /(наоборот|вопреки|не\s+так|миф|ошибал|реальность|один\s+разработчик|actually|wrong|myth)/iu
  ],
  specific_result: [
    /(\d|%|результ|вырос|упал|лид|продаж|час|дней|result|growth|saved)/iu
  ],
  stakes: [
    /(риск|потер|без\s+\p{L}+|цена|угроз|дедлайн|поздно|слежк|risk|stakes|deadline)/iu
  ],
  object_proof: [
    /(\d|экран|документ|таблиц|инструмент|воронк|заявк|лид|метрик|чек|взломан|интернет|разработчик|устройств|screen|tool|proof)/iu
  ],
  visual_pair: [
    /(до\s+и\s+после|против|vs|ожидани|реальность|стар|нов|было|стало|before|after|versus)/iu
  ]
};

export type HookFrameworkMatch = {
  framework?: ThumbnailHookFramework;
  score: number;
  reasons: string[];
};

export function normalizeHookFramework(value?: string): ThumbnailHookFramework | undefined {
  const normalized = value?.trim().toLocaleLowerCase("ru").replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;
  if (isThumbnailHookFramework(normalized)) return normalized;
  return FRAMEWORK_ALIASES[normalized];
}

export function scoreHookFramework(text: string, candidateAngle?: string): HookFrameworkMatch {
  const framework = normalizeHookFramework(candidateAngle);
  const detected = scoreFrameworkSignals(text);
  const reasons: string[] = [];

  if (!framework) {
    return { framework, score: detected.score, reasons: detected.reasons };
  }

  const requestedScore = signalScore(text, framework);
  if (requestedScore > 0) reasons.push(`matches_${framework}`);
  if (requestedScore === 0 && candidateAngle) reasons.push("weak_framework_fit");

  return {
    framework,
    score: requestedScore > 0 ? requestedScore + 12 : 0,
    reasons
  };
}

function scoreFrameworkSignals(text: string): HookFrameworkMatch {
  let best: HookFrameworkMatch = { score: 0, reasons: [] };

  for (const framework of Object.keys(FRAMEWORK_SIGNALS) as ThumbnailHookFramework[]) {
    const score = signalScore(text, framework);
    if (score > best.score) {
      best = {
        framework,
        score,
        reasons: score > 0 ? [`detected_${framework}`] : []
      };
    }
  }

  return best;
}

function signalScore(text: string, framework: ThumbnailHookFramework): number {
  return FRAMEWORK_SIGNALS[framework].some((pattern) => pattern.test(text)) ? 12 : 0;
}
