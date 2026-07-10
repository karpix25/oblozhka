export const THUMBNAIL_HOOK_FRAMEWORKS = [
  "mistake_cost",
  "hidden_reason",
  "counterintuitive",
  "specific_result",
  "stakes",
  "object_proof",
  "visual_pair"
] as const;

export type ThumbnailHookFramework = typeof THUMBNAIL_HOOK_FRAMEWORKS[number];

export type ThumbnailHookFrameworkDefinition = {
  id: ThumbnailHookFramework;
  promptLabel: string;
  promptRule: string;
};

export const THUMBNAIL_HOOK_FRAMEWORK_DEFINITIONS: readonly ThumbnailHookFrameworkDefinition[] = [
  {
    id: "mistake_cost",
    promptLabel: "ошибка и цена",
    promptRule: "покажи конкретную ошибку и её цену, потерю или последствие из transcript"
  },
  {
    id: "hidden_reason",
    promptLabel: "скрытая причина",
    promptRule: "назови причину, механизм или препятствие, которое действительно раскрывается в transcript"
  },
  {
    id: "counterintuitive",
    promptLabel: "контринтуитивный поворот",
    promptRule: "дай неожиданный вывод против обычного ожидания, но только если он подтверждён источником"
  },
  {
    id: "specific_result",
    promptLabel: "конкретный результат",
    promptRule: "используй результат, изменение, цифру или измеримый исход, который есть в transcript"
  },
  {
    id: "stakes",
    promptLabel: "ставки и риск",
    promptRule: "покажи риск, дедлайн, угрозу, цену бездействия или важное последствие"
  },
  {
    id: "object_proof",
    promptLabel: "доказательство объектом",
    promptRule: "назови видимый объект, метрику, экран, документ, инструмент, место или артефакт из transcript"
  },
  {
    id: "visual_pair",
    promptLabel: "визуальная пара",
    promptRule: "создай визуальный контраст для обложки: до/после, старое/новое, ожидание/реальность или A против B"
  }
];

export function isThumbnailHookFramework(value: string | undefined): value is ThumbnailHookFramework {
  return THUMBNAIL_HOOK_FRAMEWORKS.includes(value as ThumbnailHookFramework);
}
