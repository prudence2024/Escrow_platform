import { TransactionStatus, STATUSES } from "../config";

export class StateTransitionError extends Error {
  constructor(from: TransactionStatus, to: TransactionStatus) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = "StateTransitionError";
  }
}

/**
 * Allowed transitions. Drawn from docs/transaction-state-machine.md. Server
 * mutations must route through transitionTo() so invalid moves are rejected.
 */
export const ALLOWED_TRANSITIONS: Record<
  TransactionStatus,
  ReadonlySet<TransactionStatus>
> = {
  DRAFT: new Set([STATUSES.PENDING_BUYER_ACCEPTANCE, STATUSES.CANCELLED]),
  PENDING_BUYER_ACCEPTANCE: new Set([
    STATUSES.AWAITING_PAYMENT,
    STATUSES.CANCELLED,
    STATUSES.EXPIRED,
  ]),
  AWAITING_PAYMENT: new Set([
    STATUSES.PAYMENT_PROCESSING,
    STATUSES.CANCELLED,
    STATUSES.EXPIRED,
  ]),
  PAYMENT_PROCESSING: new Set([
    STATUSES.PAYMENT_SECURED,
    STATUSES.CANCELLED, // failed payment unwind (refund handled separately)
  ]),
  PAYMENT_SECURED: new Set([
    STATUSES.READY_FOR_DELIVERY,
    STATUSES.DISPATCHED,
    STATUSES.DISPUTED,
  ]),
  READY_FOR_DELIVERY: new Set([STATUSES.DISPATCHED, STATUSES.DISPUTED]),
  DISPATCHED: new Set([
    STATUSES.DELIVERED_PENDING_INSPECTION,
    STATUSES.DISPUTED,
  ]),
  DELIVERED_PENDING_INSPECTION: new Set([
    STATUSES.ACCEPTED,
    STATUSES.DISPUTED,
  ]),
  ACCEPTED: new Set([STATUSES.RELEASE_PENDING, STATUSES.DISPUTED]),
  RELEASE_PENDING: new Set([
    STATUSES.SETTLED,
    STATUSES.DISPUTED,
    STATUSES.REFUND_PENDING, // payout reversal fallback
  ]),
  SETTLED: new Set(),
  DISPUTED: new Set([STATUSES.RELEASE_PENDING, STATUSES.REFUND_PENDING]),
  REFUND_PENDING: new Set([STATUSES.REFUNDED]),
  REFUNDED: new Set(),
  CANCELLED: new Set(),
  EXPIRED: new Set(),
};

export function assertCanTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): void {
  if (!ALLOWED_TRANSITIONS[from]?.has(to)) {
    throw new StateTransitionError(from, to);
  }
}

// precedence for sorting a timeline "done-ness"
export const STATUS_ORDER: Record<TransactionStatus, number> = {
  DRAFT: 0,
  PENDING_BUYER_ACCEPTANCE: 1,
  AWAITING_PAYMENT: 2,
  PAYMENT_PROCESSING: 3,
  PAYMENT_SECURED: 4,
  READY_FOR_DELIVERY: 5,
  DISPATCHED: 6,
  DELIVERED_PENDING_INSPECTION: 7,
  ACCEPTED: 8,
  RELEASE_PENDING: 9,
  SETTLED: 10,
  DISPUTED: 3, // blocks settlement but "active"
  REFUND_PENDING: 4,
  REFUNDED: 5,
  CANCELLED: 0,
  EXPIRED: 0,
};

export const isTerminal = (s: TransactionStatus) =>
  s === STATUSES.SETTLED ||
  s === STATUSES.REFUNDED ||
  s === STATUSES.CANCELLED ||
  s === STATUSES.EXPIRED;

export const canOpenDispute = (s: TransactionStatus) =>
  s === STATUSES.PAYMENT_SECURED ||
  s === STATUSES.READY_FOR_DELIVERY ||
  s === STATUSES.DISPATCHED ||
  s === STATUSES.DELIVERED_PENDING_INSPECTION ||
  s === STATUSES.ACCEPTED ||
  s === STATUSES.RELEASE_PENDING;