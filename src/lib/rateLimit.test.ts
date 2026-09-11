/**
 * Rate-limit policy tests (Phase 2, §8/§14).
 */
import { describe, expect, it } from "vitest";
import { decideRateLimit, RATE_LIMIT_POLICIES } from "./rateLimit";
import type { RateLimitBucket } from "./rateLimit";

const POLICY = { limit: 3, windowMs: 60_000 };

describe("sliding-window decisions", () => {
  it("allows up to the limit then denies with retryAfter at window end", () => {
    const t0 = 1_000_000;
    let bucket: RateLimitBucket | null = null;
    for (let i = 0; i < 3; i++) {
      const d = decideRateLimit(bucket, POLICY, t0 + i);
      expect(d.allowed).toBe(true);
      bucket = d.next;
    }
    const denied = decideRateLimit(bucket, POLICY, t0 + 3);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfter).toBe(t0 + 60_000);
    // Denial does not consume.
    expect(denied.next.count).toBe(3);
  });

  it("resets after the window expires", () => {
    const t0 = 2_000_000;
    const full = { windowStart: t0, count: 3 };
    const d = decideRateLimit(full, POLICY, t0 + 60_001);
    expect(d.allowed).toBe(true);
    expect(d.next).toEqual({ windowStart: t0 + 60_001, count: 1 });
  });

  it("rejects invalid policies", () => {
    expect(() => decideRateLimit(null, { limit: 0, windowMs: 1000 }, 0)).toThrow();
    expect(() => decideRateLimit(null, { limit: 1, windowMs: 0 }, 0)).toThrow();
  });

  it("curated policies are sane (positive limits, minute-or-hour windows)", () => {
    for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
      expect(policy.limit).toBeGreaterThan(0);
      expect(policy.windowMs).toBeGreaterThanOrEqual(60_000);
    }
  });
});
