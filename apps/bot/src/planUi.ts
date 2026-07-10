import type { BillingAccess } from "@covers/db";
import { canUseEntitlement, type EntitlementSubject } from "@covers/domain";

export function entitlementSubjectForAccess(access: BillingAccess): EntitlementSubject {
  return access.kind === "trial" ? { kind: "trial" } : { kind: "subscription", plan: access.plan };
}

export function canUseCustomStyle(access: BillingAccess) {
  return canUseEntitlement(entitlementSubjectForAccess(access), "CUSTOM_STYLE_UPLOAD");
}

export function customStyleMenuLabel(access?: BillingAccess, label = "🎭 Мои стили") {
  return access && !canUseCustomStyle(access) ? `${label} ⭐ Pro` : label;
}

export function customStyleSourceLabel(access?: BillingAccess, label = "🎭 Мой стиль") {
  return access && !canUseCustomStyle(access) ? `${label} ⭐ Pro` : label;
}

export function customStyleUploadLabel(access?: BillingAccess) {
  return access && !canUseCustomStyle(access) ? "➕ Загрузить стиль ⭐ Pro" : "➕ Загрузить стиль";
}
