/**
 * SettlementRepository — authorized payouts (§37, §25).
 * Exactly one PAID settlement per transaction (partial unique index).
 * Provider execution arrives in a later phase; this contract models intent,
 * eligibility state, and idempotent recording.
 */

export type SettlementStatus = "PENDING" | "PAID" | "FAILED";

export interface Settlement {
  id: string;
  transactionId: string;
  payeeId: string;
  amountMinor: number;
  currency: string;
  status: SettlementStatus;
  provider: string;
  providerReference: string | null;
  idempotencyKey: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface SettlementRepository {
  findPaidByTransaction(transactionId: string): Promise<Settlement | null>;
  create(input: Omit<Settlement, "id" | "status" | "completedAt" | "createdAt">): Promise<Settlement>;
  markPaid(id: string, providerReference: string, completedAt: number): Promise<Settlement>;
  markFailed(id: string): Promise<Settlement>;
}
