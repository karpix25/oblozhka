import { PAID_PLAN_ORDER, PLAN_CONFIGS, TRIAL_CREDITS, type PaidPlan } from "@covers/domain";
import type { BillingAccess } from "@covers/db";
import { InlineKeyboard } from "grammy";

type TariffPackage = {
  id: string;
  title: string;
  description?: string | null;
  priceRub: number;
  credits: number;
  plan?: PaidPlan | null;
};

export function tariffsMessage() {
  return [
    "Тарифы и цены:",
    "",
    `Пробный доступ — ${TRIAL_CREDITS} кредита`,
    "Для нового пользователя.",
    "",
    ...PAID_PLAN_ORDER.flatMap((plan) => tariffLines(plan)),
    "Как списываются кредиты:",
    "1 генерация = 1 кредит.",
    "1 AI-правка готовой обложки = 1 кредит.",
    "",
    "Кредиты Старт и Про обновляются каждый месяц и не переносятся.",
    "Бизнес получает безлимит по кредитам, но расход всё равно учитывается для аналитики."
  ].join("\n");
}

export function balanceMessage(access: BillingAccess) {
  if (access.kind === "trial") {
    return [
      `Пробный доступ: осталось ${access.remainingCredits} из ${TRIAL_CREDITS} кредитов.`,
      "",
      "Когда кредиты закончатся, выберите тариф для продолжения генераций."
    ].join("\n");
  }

  const title = PLAN_CONFIGS[access.plan].title;
  if (access.remainingCredits === null) {
    return [`Тариф: ${title}`, "Кредиты: безлимит", `Период до: ${formatDate(access.currentPeriodEnd)}`].join("\n");
  }

  return [
    `Тариф: ${title}`,
    `Осталось кредитов: ${access.remainingCredits} из ${access.monthlyCreditLimit}`,
    `Период до: ${formatDate(access.currentPeriodEnd)}`
  ].join("\n");
}

export function insufficientCreditsMessage() {
  return [
    "Кредиты закончились.",
    "",
    "Чтобы продолжить генерации и правки, выберите тариф: Start, Pro или Business.",
    "Нажмите «Выбрать тариф», и бот сразу откроет оплату."
  ].join("\n");
}

export function avatarLimitMessage(limit: number | null) {
  if (limit === null) {
    return "Лимит аватаров не достигнут.";
  }
  if (limit === 1) {
    return [
      "На текущем доступе можно сохранить 1 аватар.",
      "",
      "Кнопки загрузки остаются видны, но новые аватары откроются после апгрейда: Pro даёт до 10 аватаров, Business — без жесткого лимита.",
      "Можно использовать уже сохранённый аватар или перейти на тариф выше."
    ].join("\n");
  }
  return [
    `Лимит аватаров на вашем доступе: ${limit}.`,
    "",
    "Можно использовать уже сохранённый аватар или перейти на тариф выше. Business даёт аватары без жесткого лимита."
  ].join("\n");
}

export function paymentSuccessMessage(access: BillingAccess) {
  return ["Оплата прошла.", "", balanceMessage(access)].join("\n");
}

export function tariffPackagesKeyboard(packages: TariffPackage[]) {
  const keyboard = new InlineKeyboard();
  packages.forEach((pack) => {
    keyboard.text(packageButtonLabel(pack), `buy:${pack.id}`).row();
  });
  keyboard.text("⬅️ Назад", "tariffs").text("🏠 В начало", "home");
  return keyboard;
}

function tariffLines(plan: PaidPlan) {
  const config = PLAN_CONFIGS[plan];
  const credits = config.monthlyCredits === null ? "безлимит кредитов" : `${config.monthlyCredits} кредитов в месяц`;
  const avatars = config.avatarLimit === null ? "аватары без жесткого лимита" : `${config.avatarLimit} ${avatarWord(config.avatarLimit)}`;
  const queue = config.features.includes("PRIORITY_QUEUE") ? "приоритетная очередь" : "обычная очередь";
  const style = config.features.includes("STYLE_COPY")
    ? "свой стиль и копирование стиля"
    : "AI-правки, без своего стиля";
  return [
    `${config.title} — ${formatRub(config.defaultPriceRub)} / месяц`,
    `• ${credits}`,
    `• ${avatars}`,
    `• ${queue}`,
    `• ${style}`,
    ""
  ];
}

function packageButtonLabel(pack: TariffPackage) {
  if (pack.plan) {
    const config = PLAN_CONFIGS[pack.plan];
    const credits = config.monthlyCredits === null ? "безлимит" : `${config.monthlyCredits} кредитов/мес`;
    return `${config.title}: ${credits} за ${pack.priceRub} ₽`;
  }
  return `${pack.title}: ${pack.credits} кредитов за ${pack.priceRub} ₽`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatRub(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function avatarWord(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "аватар";
  }
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "аватара";
  }
  return "аватаров";
}
