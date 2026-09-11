/**
 * Pure sliding-window rate-limit math (Phase 2, §8).
 *
 * The persistent counter lives in the database (Convex `rate_limit_counters`
 * table today); this module decides allow/deny/reset deterministically so the
 * policy is unit-tested and portable to the future Node API.
 */

export interface RateLimitBucket {
  /** Epoch ms of the current window start. */
  windowStart: number;
  /** Requests consumed in the current window. */
  count: number;
}

export interface RateLimitPolicy {
  /** Maximum requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Bucket state to persist after this decision. */
  next: RateLimitBucket;
  /** Epoch ms when the caller may retry (== now when allowed). */
  retryAfter: number;
}

export function decideRateLimit(
  bucket: RateLimitBucket | null,
  policy: RateLimitPolicy,
  now: number,
): RateLimitDecision {
  if (!Number.isFinite(policy.limit) || policy.limit < 1) {
    throw new Error("Rate limit must be a positive integer");
  }
  if (!Number.isFinite(policy.windowMs) || policy.windowMs < 1) {
    throw new Error("Rate window must be positive");
  }
  const current: RateLimitBucket =
    bucket === null || now - bucket.windowStart >= policy.windowMs
      ? { windowStart: now, count: 0 }
      : bucket;
  if (current.count < policy.limit) {
    return {
      allowed: true,
      next: { windowStart: current.windowStart, count: current.count + 1 },
      retryAfter: now,
    };
  }
  return {
    allowed: false,
    next: current,
    retryAfter: current.windowStart + policy.windowMs,
  };
}

/** Curated per-action policies (centralized; see server wiring for scope). */
export const RATE_LIMIT_POLICIES = {
  /** Transaction creation per user: abuse/velocity control. */
  txCreatePerUser: { limit: 20, windowMs: 60 * 60 * 1000 },
  /** Dispatch (OTP re-issue) per transaction: closes regeneration floods. */
  dispatchPerTx: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Dispute opening per user. */
  disputeOpenPerUser: { limit: 10, windowMs: 60 * 60 * 1000 },
  /** Dispute messages per user. */
  disputeMessagePerUser: { limit: 60, windowMs: 60 * 60 * 1000 },
  /** Buyer acceptance per user. */
  acceptPerUser: { limit: 60, windowMs: 60 * 60 * 1000 },
  /** Staff role changes per admin (sensitive-action throttle). */
  roleChangePerAdmin: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
