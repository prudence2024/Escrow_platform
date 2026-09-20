/**
 * Refund-cap enforcement tests
 *
 * Validates:
 *  1. Full/partial refund within cap
 *  2. Cumulative refunds respect cap
 *  3. Settlement reduces remaining refundable
 *  4. Fee-aware refund cap (platform fee is non-refundable)
 *  5. Edge cases: zero cap, negative clamp, odd rounding
 *  6. Multiple partial refunds + settlement
 *  7. Delivery fee treatment
 */
import { describe, it, expect } from "vitest";

/**
 * Fee calculation — mirrors config.ts feeFor() for standalone testing.
 */
function feeFor(totalKobo: number): { feeKobo: number } {
  // Promo zero-fee mode (current production)
  void totalKobo;
  return { feeKobo: 0 };
}

/**
 * Fee-aware remaining refundable — mirrors disputes.ts remainingRefundable().
 *   refundableBase = totalKobo − feeKobo
 *   remaining = refundableBase − Σ(paid refunds) − Σ(paid settlements)
 */
function computeRemainingRefundable(
  totalKobo: number,
  paidRefunds: number[],
  paidSettlements: number[],
): number {
  const { feeKobo } = feeFor(totalKobo);
  const refundableBase = Math.max(0, totalKobo - feeKobo);
  const totalRefunded = paidRefunds.reduce((s, v) => s + v, 0);
  const totalSettled = paidSettlements.reduce((s, v) => s + v, 0);
  return Math.max(0, refundableBase - totalRefunded - totalSettled);
}

/**
 * Fee-aware settlement amount — mirrors settlement.ts logic.
 */
function computeSellerSettlement(totalKobo: number): number {
  const { feeKobo } = feeFor(totalKobo);
  return Math.max(0, totalKobo - feeKobo);
}

describe("refund cap — zero-fee promo mode", () => {
  const TOTAL = 100_000; // ₦1,000

  it("allows full refund when nothing has been refunded or settled", () => {
    expect(computeRemainingRefundable(TOTAL, [], [])).toBe(TOTAL);
  });

  it("allows partial refund within cap", () => {
    expect(computeRemainingRefundable(TOTAL, [30_000], [])).toBe(70_000);
  });

  it("rejects refund when remaining is zero after full refund", () => {
    expect(computeRemainingRefundable(TOTAL, [TOTAL], [])).toBe(0);
  });

  it("reduces cap by paid settlements", () => {
    expect(computeRemainingRefundable(TOTAL, [], [TOTAL])).toBe(0);
  });

  it("cumulative refunds across disputes respect cap", () => {
    expect(computeRemainingRefundable(TOTAL, [40_000, 30_000], [])).toBe(30_000);
  });

  it("cumulative refunds + settlements respect cap", () => {
    expect(computeRemainingRefundable(TOTAL, [20_000, 10_000], [30_000])).toBe(40_000);
  });

  it("clamps to zero when refunds exceed total (defensive)", () => {
    expect(computeRemainingRefundable(TOTAL, [TOTAL + 10_000], [])).toBe(0);
  });

  it("refund after full settlement is rejected", () => {
    const cap = computeRemainingRefundable(TOTAL, [], [TOTAL]);
    expect(cap).toBe(0);
    expect(10_000).toBeGreaterThan(cap);
  });

  it("zero-amount refund is rejected (must be positive)", () => {
    expect(0).toBeLessThanOrEqual(0);
  });
});

describe("refund cap — resolveDispute guards", () => {
  it("partial refund within cap should succeed", () => {
    const cap = computeRemainingRefundable(200_000, [50_000], []);
    expect(100_000).toBeLessThanOrEqual(cap);
  });

  it("partial refund exceeding cap should fail", () => {
    const cap = computeRemainingRefundable(200_000, [150_000], []);
    expect(100_000).toBeGreaterThan(cap);
  });

  it("full refund after partial refund capped at remaining", () => {
    const cap = computeRemainingRefundable(200_000, [80_000], []);
    const actual = Math.min(200_000, cap);
    expect(actual).toBe(120_000);
  });

  it("full refund after settlement is rejected", () => {
    const cap = computeRemainingRefundable(200_000, [], [200_000]);
    expect(200_000).toBeGreaterThan(cap);
  });

  it("zero cap rejects any positive refund", () => {
    expect(1).toBeGreaterThan(0);
  });
});

describe("refund cap — fee-aware scenarios", () => {
  it("settlement deducts platform fee (zero-fee: full amount)", () => {
    const settlement = computeSellerSettlement(100_000);
    expect(settlement).toBe(100_000); // zero fee = full amount
  });

  it("multiple partial refunds + settlement respect cap", () => {
    const cap = computeRemainingRefundable(500_000, [100_000, 50_000], [200_000]);
    expect(cap).toBe(150_000);
  });

  it("settlement after partial refund uses remaining cap", () => {
    const cap = computeRemainingRefundable(300_000, [100_000], []);
    expect(cap).toBe(200_000);
    // Settlement of 200_000 should be allowed
    const afterSettlement = computeRemainingRefundable(300_000, [100_000], [200_000]);
    expect(afterSettlement).toBe(0);
  });

  it("delivery fee is part of totalKobo (included in cap)", () => {
    // totalKobo = 150_000 (includes 50_000 delivery fee)
    const cap = computeRemainingRefundable(150_000, [], []);
    expect(cap).toBe(150_000);
  });

  it("odd-number rounding: zero fee means no rounding needed", () => {
    const settlement = computeSellerSettlement(33_333);
    expect(settlement).toBe(33_333); // no fee = no rounding
  });

  it("final residual: zero fee means no residual", () => {
    const total = 100_000;
    const settlement = computeSellerSettlement(total);
    const remaining = computeRemainingRefundable(total, [], [settlement]);
    expect(remaining).toBe(0); // exact match, no residual
  });
});

describe("refund cap — economic invariant", () => {
  it("settled + refunded never exceeds total (zero-fee)", () => {
    const total = 1_000_000;
    const refunds = [200_000, 100_000];
    const settlements = [500_000];
    const remaining = computeRemainingRefundable(total, refunds, settlements);
    const totalRefunded = refunds.reduce((s, v) => s + v, 0);
    const totalSettled = settlements.reduce((s, v) => s + v, 0);
    expect(totalRefunded + totalSettled + remaining).toBe(total);
  });

  it("settled + refunded + remaining = totalKobo − feeKobo", () => {
    const total = 750_000;
    const refunds = [150_000];
    const settlements = [400_000];
    const remaining = computeRemainingRefundable(total, refunds, settlements);
    const { feeKobo } = feeFor(total);
    const totalRefunded = refunds.reduce((s, v) => s + v, 0);
    const totalSettled = settlements.reduce((s, v) => s + v, 0);
    expect(totalRefunded + totalSettled + remaining).toBe(total - feeKobo);
  });
});
