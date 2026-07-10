import { debitGenerationCreditInTransaction } from "./credits.js";

export function generationBillingData(
  access: Awaited<ReturnType<typeof debitGenerationCreditInTransaction>>["access"]
) {
  if (access.kind === "subscription") {
    return {
      chargedPlan: access.plan,
      chargedSubscriptionId: access.subscriptionId,
      queuePriority: access.queuePriority
    };
  }
  return { queuePriority: access.queuePriority };
}
