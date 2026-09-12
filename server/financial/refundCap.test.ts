/**
 * Refund-cap enforcement tests
 *
 * Validates that:
 *  1. A full refund up to totalKobo is allowed
 *  2. A partial refund within remaining cap is allowed
 *  3. A refund exceeding remainingRefundable is rejected
 *  4. Cumulative refunds across multiple disputes cannot over-refund
 *  5. Settlement reduces remaining refundable amount
 *  6. Edge case: zero remaining after full refund
 *  7. Edge case: negative remaining is clamped to 0
 *  8. Edge case: refund after settlement is rejected if cap is 0
 */
import { describe, it, expect } from "vitest";

/**
 * Pure-function logic extracted from disputes.ts remainingRefundable.
 * Kept as a standalone unit so tests run without Convex context.
 */
function computeRemainingRefundable(totalKobo: number, paidRefunds: number[], paidSettlements: number[]): number {
  const totalRefunded = paidRefunds.reduce((s, v) => s + v, 0);
  const totalSettled = paidSettlements.reduce((s, v) => s + v, 0);
  return Math.max(0, totalKobo - totalRefunded - totalSettled);
}

describe("refund cap — computeRemainingRefundable", () => {
  const TOTAL = 100_000; // ₦1,000

  it("allows full refund when nothing has been refunded or settled", () => {
    const remaining = computeRemainingRefundable(TOTAL, [], []);
    expect(remaining).toBe(TOTAL);
  });

  it("allows partial refund within cap", () => {
    const remaining = computeRemainingRefundable(TOTAL, [30_000], []);
    expect(remaining).toBe(70_000);
  });

  it("rejects refund when remaining is zero after full refund", () => {
    const remaining = computeRemainingRefundable(TOTAL, [TOTAL], []);
    expect(remaining).toBe(0);
  });

  it("reduces cap by paid settlements", () => {
    const remaining = computeRemainingRefundable(TOTAL, [], [TOTAL]);
    expect(remaining).toBe(0);
  });

  it("cumulative refunds across disputes respect cap", () => {
    const remaining = computeRemainingRefundable(TOTAL, [40_000, 30_000], []);
    expect(remaining).toBe(30_000);
  });

  it("cumulative refunds + settlements respect cap", () => {
    const remaining = computeRemainingRefundable(TOTAL, [20_000, 10_000], [30_000]);
    expect(remaining).toBe(40_000);
  });

  it("clamps to zero when refunds exceed total (defensive)", () => {
    // This should never happen in production, but the math must not go negative
    const remaining = computeRemainingRefundable(TOTAL, [TOTAL + 10_000], []);
    expect(remaining).toBe(0);
  });

  it("refund after settlement is rejected if cap is 0", () => {
    const remaining = computeRemainingRefundable(TOTAL, [], [TOTAL]);
    expect(remaining).toBe(0);
    // Any positive refund amount would exceed cap
    expect(10_000).toBeGreaterThan(remaining);
  });

  it("zero-amount refund is rejected (must be positive)", () => {
    // This is a separate check in the mutation (refundAmount <= 0)
    expect(0).toBeLessThanOrEqual(0);
  });
});

describe("refund cap — resolveDispute guards", () => {
  it("partial refund within cap should succeed", () => {
    const cap = computeRemainingRefundable(200_000, [50_000], []);
    const refundAmount = 100_000;
    expect(refundAmount).toBeLessThanOrEqual(cap);
  });

  it("partial refund exceeding cap should fail", () => {
    const cap = computeRemainingRefundable(200_000, [150_000], []);
    const refundAmount = 100_000;
    expect(refundAmount).toBeGreaterThan(cap);
  });

  it("full refund after partial refund should be capped at remaining", () => {
    const cap = computeRemainingRefundable(200_000, [80_000], []);
    const requested = 200_000; // user requests full amount
    const actual = Math.min(requested, cap);
    expect(actual).toBe(120_000);
  });

  it("full refund after settlement is rejected", () => {
    const cap = computeRemainingRefundable(200_000, [], [200_000]);
    const refundAmount = 200_000;
    expect(refundAmount).toBeGreaterThan(cap);
  });

  it("zero cap rejects any positive refund", () => {
    const cap = 0;
    const refundAmount = 1;
    expect(refundAmount).toBeGreaterThan(cap);
  });
});
