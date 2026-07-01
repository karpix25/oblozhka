import type { ProjectPlatform } from "@covers/domain";

export function platformLabel(platform: ProjectPlatform | null) {
  if (platform === "YOUTUBE") return "YouTube";
  if (platform === "INSTAGRAM_TIKTOK") return "Reels/TikTok";
  if (platform === "FACELESS") return "Faceless";
  return "формат не выбран";
}

export function projectStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "черновик",
    SOURCE_READY: "источник принят",
    SOURCE_PROCESSING: "анализирую ролик",
    SOURCE_FAILED: "нужен текст ролика",
    HOOKS_PENDING: "готовлю текст",
    HOOKS_READY: "текст готов",
    GENERATION_PENDING: "генерируется",
    COMPLETED: "готово",
    FAILED: "ошибка"
  };
  return labels[status] ?? status.toLowerCase();
}
