import { debitGenerationCreditInTransaction } from "./credits.js";

export function generationBillingData(
  access: Awaited<ReturnType<typeof debitGenerationCreditInTransaction>>["access"]
) {
  if (access.kind === "superadmin") {
    return {
      chargedPlan: access.plan,
      creditCost: 0,
      queuePriority: access.queuePriority
    };
  }
  if (access.kind === "subscription") {
    return {
      chargedPlan: access.plan,
      chargedSubscriptionId: access.subscriptionId,
      queuePriority: access.queuePriority
    };
  }
  return { queuePriority: access.queuePriority };
}
