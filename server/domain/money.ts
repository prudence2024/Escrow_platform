/**
 * DealSure money guards (Phase 3, §16–§17).
 *
 * Authoritative money is INTEGER minor units (kobo for NGN). SQLite INTEGER
 * is 64-bit, but JavaScript Numbers are exactly safe only within
 * Number.MAX_SAFE_INTEGER — legitimate values must never exceed it, and the
 * domain layer must reject anything that does instead of silently rounding.
 *
 * Product ceiling (₦10,000,000 per transaction, mirroring Convex LIMITS) is
 * far below the JS limit; both are enforced here so violations fail loudly
 * at the boundary, never in storage.
 */

export const KOBO_PER_NAIRA = 100;

/** Maximum single-transaction value: ₦10,000,000 in kobo. */
export const MAX_TRANSACTION_MINOR = 10_000_000 * KOBO_PER_NAIRA;

/** Minimum single-transaction value: ₦50 in kobo. */
export const MIN_TRANSACTION_MINOR = 50 * KOBO_PER_NAIRA;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Assert a value is a safe non-negative integer amount of minor units. */
export function assertMinorAmount(value: unknown, field = "amount"): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new MoneyError(`${field} must be an integer number of minor units`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${field} exceeds JavaScript safe-integer range`);
  }
  if (value < 0) {
    throw new MoneyError(`${field} must be >= 0`);
  }
}

/** Assert a strictly positive minor-unit amount (payments, refunds, payouts). */
export function assertPositiveMinorAmount(value: unknown, field = "amount"): asserts value is number {
  assertMinorAmount(value, field);
  if ((value as number) <= 0) {
    throw new MoneyError(`${field} must be > 0`);
  }
}

/** Assert a transaction-scale amount within the product ceiling. */
export function assertTransactionMinorAmount(value: unknown, field = "amount"): asserts value is number {
  assertMinorAmount(value, field);
  const n = value as number;
  if (n < MIN_TRANSACTION_MINOR || n > MAX_TRANSACTION_MINOR) {
    throw new MoneyError(
      `${field} must be within [${MIN_TRANSACTION_MINOR}, ${MAX_TRANSACTION_MINOR}] minor units`,
    );
  }
}

/** Display-only conversion (never authoritative): kobo → naira string. */
export function formatMinorNgn(minor: number): string {
  assertMinorAmount(minor);
  return `₦${(minor / KOBO_PER_NAIRA).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
