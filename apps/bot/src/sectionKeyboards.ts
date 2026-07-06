import { InlineKeyboard } from "grammy";

export function backHomeKeyboard(backCallback = "home") {
  return new InlineKeyboard().text("⬅️ Назад", backCallback).text("🏠 В начало", "home");
}

export function balanceKeyboard() {
  return new InlineKeyboard().text("💳 Тарифы", "tariffs").row().text("🏠 В начало", "home");
}

export function insufficientCreditsKeyboard() {
  return new InlineKeyboard().text("⭐ Выбрать тариф", "packages").row().text("💎 Баланс", "balance").text("🏠 В начало", "home");
}

export function tariffsKeyboard() {
  return new InlineKeyboard().text("⭐ Выбрать тариф", "packages").row().text("⬅️ Назад", "home").text("🏠 В начало", "home");
}

export function facesKeyboard() {
  return new InlineKeyboard().text("🎨 Создать обложку", "project:start").row().text("⬅️ Назад", "home").text("🏠 В начало", "home");
}

export function projectsKeyboard() {
  return new InlineKeyboard().text("🎨 Создать обложку", "project:start").row().text("🏠 В начало", "home");
}
