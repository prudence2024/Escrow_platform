/**
 * RefundRepository — refunds with partial-refund support (§37, §26).
 * Cumulative-cap enforcement (pending + paid + new <= refundable) is atomic
 * service-layer logic; the schema contributes amount/status/idempotency
 * constraints. Provider execution arrives in a later phase.
 */

export type RefundStatus = "PENDING" | "PAID" | "FAILED";

export interface Refund {
  id: string;
  transactionId: string;
  paymentIntentId: string | null;
  amountMinor: number;
  requestedBy: string;
  approvedBy: string | null;
  status: RefundStatus;
  reason: string | null;
  currency: string;
  provider: string;
  providerReference: string | null;
  idempotencyKey: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface RefundRepository {
  create(input: Omit<Refund, "id" | "status" | "completedAt" | "createdAt">): Promise<Refund>;
  /** Sum of PENDING + PAID refunds for cap accounting. */
  outstandingForTransaction(transactionId: string): Promise<number>;
  markPaid(id: string, providerReference: string, completedAt: number): Promise<Refund>;
  markFailed(id: string): Promise<Refund>;
}
