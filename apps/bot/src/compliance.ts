import { InlineKeyboard } from "grammy";
export { tariffsMessage } from "./billingMessages.js";

const legalLinks = {
  privacy: process.env.PRIVACY_POLICY_URL ?? "https://telegra.ph/Politika-konfidencialnosti-06-21-31",
  agreement: process.env.USER_AGREEMENT_URL ?? "https://telegra.ph/Polzovatelskoe-soglashenie-04-01-19"
} as const;

export function supportContact() {
  return process.env.SUPPORT_CONTACT ?? "@karlo25";
}

export function documentsMessage() {
  return [
    "Документы и информация для пользователя:",
    "",
    "Перед оплатой и использованием сервиса можно ознакомиться с политикой конфиденциальности, пользовательским соглашением, тарифами и контактами поддержки.",
    "",
    `Поддержка: ${supportContact()}`
  ].join("\n");
}

export function supportMessage() {
  return [
    "Поддержка:",
    "",
    `Напишите нам: ${supportContact()}`,
    "",
    "По вопросам оплаты используйте также команду /paysupport. В обращении укажите ваш Telegram username и дату платежа."
  ].join("\n");
}

export function documentsKeyboard() {
  return new InlineKeyboard()
    .url("🔐 Политика конфиденциальности", legalLinks.privacy)
    .row()
    .url("📜 Пользовательское соглашение", legalLinks.agreement)
    .row()
    .text("💳 Тарифы и цены", "tariffs")
    .row()
    .text("💬 Поддержка", "support")
    .row()
    .text("🏠 В начало", "home");
}
