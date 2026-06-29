import type { LedgerReason } from "./types.js";

export type LedgerEntryInput = {
  currentBalance: number;
  amount: number;
  reason: LedgerReason;
};

export function assertPositiveCredits(credits: number): void {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }
}

export function applyLedgerEntry(input: LedgerEntryInput): number {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("Ledger amount must be a non-zero integer.");
  }

  const nextBalance = input.currentBalance + input.amount;
  if (nextBalance < 0) {
    throw new Error("Insufficient credits.");
  }

  return nextBalance;
}

export function generationDebit(cost = 1): number {
  assertPositiveCredits(cost);
  return -cost;
}
