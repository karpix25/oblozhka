import { planHasFeature, type PaidPlan, type PlanFeature } from "./plans.js";

export type TrialEntitlementSubject = {
  kind: "trial";
};

export type SubscriptionEntitlementSubject = {
  kind: "subscription";
  plan: PaidPlan;
};

export type EntitlementSubject = TrialEntitlementSubject | SubscriptionEntitlementSubject;

export type EntitlementCode = PlanFeature;

export function canUseEntitlement(subject: EntitlementSubject, entitlement: EntitlementCode): boolean {
  if (subject.kind === "trial") {
    return false;
  }

  return planHasFeature(subject.plan, entitlement);
}

export function assertCanUseEntitlement(subject: EntitlementSubject, entitlement: EntitlementCode): void {
  if (!canUseEntitlement(subject, entitlement)) {
    throw new Error(`Entitlement ${entitlement} is not available for this plan`);
  }
}

export function subscriptionSubject(plan: PaidPlan): SubscriptionEntitlementSubject {
  return { kind: "subscription", plan };
}

export const trialSubject: TrialEntitlementSubject = { kind: "trial" };
