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
    "Тарифы:",
    "",
    "Пробный доступ — 3 кредита для нового пользователя.",
    "",
    ...PAID_PLAN_ORDER.flatMap((plan) => tariffLines(plan)),
    "1 генерация = 1 кредит. 1 AI-правка готовой обложки = 1 кредит.",
    "Кредиты Start и Pro обновляются каждый месяц и не переносятся.",
    "Business получает безлимит по кредитам, но расход всё равно учитывается для аналитики."
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
  return [
    `Лимит аватаров на вашем доступе: ${limit}.`,
    "",
    "Можно использовать уже сохранённый аватар или перейти на тариф выше."
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
  const credits = config.monthlyCredits === null ? "безлимит кредитов" : `${config.monthlyCredits} кредитов / месяц`;
  const avatars = config.avatarLimit === null ? "аватары без жесткого лимита" : `${config.avatarLimit} аватар${config.avatarLimit === 1 ? "" : "ов"}`;
  const queue = config.features.includes("PRIORITY_QUEUE") ? "приоритетная очередь" : "обычная очередь";
  const style = config.features.includes("STYLE_COPY") ? "копирование стиля" : "AI-правки";
  return [`${config.title} — ${credits}`, `${avatars}, ${queue}, ${style}.`, ""];
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
