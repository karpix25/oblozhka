import test from "node:test";
import assert from "node:assert/strict";
import { applyLedgerEntry, PROJECT_STATUSES } from "../packages/domain/src/index.js";

test("project status contract covers all Prisma project states", () => {
  assert.deepEqual(PROJECT_STATUSES, [
    "DRAFT",
    "SOURCE_PROCESSING",
    "SOURCE_READY",
    "SOURCE_FAILED",
    "HOOKS_PENDING",
    "HOOKS_READY",
    "GENERATION_PENDING",
    "COMPLETED",
    "FAILED"
  ]);
});

test("credit ledger prevents negative trial balance", () => {
  assert.equal(applyLedgerEntry({ currentBalance: 3, amount: -1, reason: "GENERATION_DEBIT" }), 2);
  assert.throws(
    () => applyLedgerEntry({ currentBalance: 0, amount: -1, reason: "GENERATION_DEBIT" }),
    /Insufficient credits/
  );
});
