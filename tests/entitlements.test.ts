import test from "node:test";
import assert from "node:assert/strict";
import {
  USER_STYLE_ASSET_STATUSES,
  USER_STYLE_ASSET_LIMIT,
  assertCanUseEntitlement,
  canUseEntitlement,
  subscriptionSubject,
  trialSubject
} from "../packages/domain/src/index.js";

test("custom style upload and style copy are available only to pro and business", () => {
  for (const entitlement of ["CUSTOM_STYLE_UPLOAD", "STYLE_COPY"] as const) {
    assert.equal(canUseEntitlement(trialSubject, entitlement), false);
    assert.equal(canUseEntitlement(subscriptionSubject("START"), entitlement), false);
    assert.equal(canUseEntitlement(subscriptionSubject("PRO"), entitlement), true);
    assert.equal(canUseEntitlement(subscriptionSubject("BUSINESS"), entitlement), true);
  }
});

test("entitlement assertion rejects trial and start custom style access", () => {
  assert.throws(() => assertCanUseEntitlement(trialSubject, "CUSTOM_STYLE_UPLOAD"), /not available/);
  assert.throws(() => assertCanUseEntitlement(subscriptionSubject("START"), "STYLE_COPY"), /not available/);
  assert.doesNotThrow(() => assertCanUseEntitlement(subscriptionSubject("PRO"), "CUSTOM_STYLE_UPLOAD"));
});

test("modernization feature matrix follows Start Pro Business tiers", () => {
  assert.equal(canUseEntitlement(subscriptionSubject("START"), "AI_EDITING"), true);
  assert.equal(canUseEntitlement(subscriptionSubject("START"), "REPLICATE_TEMPLATE"), false);
  assert.equal(canUseEntitlement(subscriptionSubject("PRO"), "REPLICATE_TEMPLATE"), true);
  assert.equal(canUseEntitlement(subscriptionSubject("PRO"), "FACE_EXPRESSIONS"), false);
  assert.equal(canUseEntitlement(subscriptionSubject("BUSINESS"), "FACE_EXPRESSIONS"), true);
  assert.equal(canUseEntitlement(subscriptionSubject("BUSINESS"), "AI_FILTERS"), true);
});

test("user style asset status contract is explicit", () => {
  assert.deepEqual(USER_STYLE_ASSET_STATUSES, ["UPLOADED", "ANALYZING", "READY", "REJECTED", "FAILED"]);
  assert.equal(USER_STYLE_ASSET_LIMIT, null);
});
