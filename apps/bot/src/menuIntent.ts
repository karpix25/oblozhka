export type MenuIntent =
  | "create"
  | "templates"
  | "faces"
  | "styles"
  | "projects"
  | "covers"
  | "tariffs"
  | "documents"
  | "balance"
  | "help";

const legacyLabels: Record<MenuIntent, string> = {
  create: "🎨 Создать",
  templates: "🖼 Шаблоны",
  faces: "👤 Лица",
  styles: "🎭 Мои стили",
  projects: "📁 Проекты",
  covers: "🖼 Обложки",
  tariffs: "💳 Тарифы",
  documents: "📄 Документы",
  balance: "💎 Баланс",
  help: "❓ Помощь"
};

const aliases: Array<{ intent: MenuIntent; values: string[] }> = [
  { intent: "create", values: ["создать", "создать обложку", "сделать обложку", "новая обложка", "начать"] },
  { intent: "templates", values: ["шаблоны", "библиотека шаблонов"] },
  { intent: "faces", values: ["лица", "мои лица", "аватары", "мои аватары"] },
  { intent: "styles", values: ["стили", "мои стили", "свой стиль"] },
  { intent: "projects", values: ["проекты", "мои проекты"] },
  { intent: "covers", values: ["обложки", "мои обложки", "история обложек", "готовые обложки"] },
  { intent: "tariffs", values: ["тарифы", "цены", "оплата", "купить"] },
  { intent: "documents", values: ["документы", "оферта", "политика", "соглашение"] },
  { intent: "balance", values: ["баланс", "кредиты", "мой баланс"] },
  { intent: "help", values: ["помощь", "поддержка", "как это работает"] }
];

export function menuIntentFromText(text: string | undefined): MenuIntent | undefined {
  const normalized = normalizeMenuText(text);
  if (!normalized) return undefined;

  for (const [intent, label] of Object.entries(legacyLabels) as Array<[MenuIntent, string]>) {
    if (normalizeMenuText(label) === normalized) return intent;
  }

  return aliases.find((entry) => entry.values.includes(normalized))?.intent;
}

export function legacyMenuLabel(intent: MenuIntent) {
  return legacyLabels[intent];
}

function normalizeMenuText(text: string | undefined) {
  return text
    ?.trim()
    .toLowerCase()
    .replace(/[🎨🖼👤🎭📁💳📄💎❓]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
