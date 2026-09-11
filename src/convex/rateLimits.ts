/**
 * Persistent server-side rate limiting (Phase 2, §8).
 *
 * Policy math lives in src/lib/rateLimit.ts (pure, tested); this module
 * persists buckets in the `rate_limit_counters` table. Enforceable only
 * where a mutation/action context with a stable key exists:
 *
 * IMPLEMENTED: tx create, dispatch (OTP re-issue), dispute open/message,
 * buyer accept, staff role changes.
 * DEFERRED_TO_API_GATEWAY: email-OTP send (provider path exposes no ctx),
 * invite lookup (read-only query), IP-based limits (no reliable client IP).
 * Email-OTP *verification* brute force is provider-managed
 * (authRateLimits, 10 failed/hr default).
 */

import { MutationCtx } from "./_generated/server";
import {
  RateLimitPolicyName,
  RATE_LIMIT_POLICIES,
  decideRateLimit,
} from "../lib/rateLimit";

export class RateLimitedError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Consume one unit of `policy` for `keySuffix` (user id, tx id, ...).
 * Throws RateLimitedError (generic message, no internals) when exhausted.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  policyName: RateLimitPolicyName,
  keySuffix: string,
  now: number = Date.now(),
): Promise<void> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const key = `${policyName}:${keySuffix}`;
  const existing = await ctx.db
    .query("rate_limit_counters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const decision = decideRateLimit(
    existing
      ? { windowStart: existing.windowStart, count: existing.count }
      : null,
    policy,
    now,
  );
  if (existing) {
    await ctx.db.patch(existing._id, {
      windowStart: decision.next.windowStart,
      count: decision.next.count,
    });
  } else {
    await ctx.db.insert("rate_limit_counters", {
      key,
      windowStart: decision.next.windowStart,
      count: decision.next.count,
    });
  }
  if (!decision.allowed) {
    throw new RateLimitedError(decision.retryAfter - now);
  }
}
