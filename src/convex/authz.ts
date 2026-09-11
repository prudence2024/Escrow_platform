/**
 * DealSure server-side authorization (Phase 2, §4–§5, §10–§11).
 *
 * Every consequential Convex function resolves a trusted principal from the
 * session (never from args) and enforces policy.ts guards here. The legacy
 * lib.ts helpers (requireUser/requireStaff/requireAdmin) are intentionally
 * untouched so existing call sites keep working; new code uses these guards.
 */

import { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";
import type {
  AuthenticatedPrincipal,
  CanonicalRole,
} from "../lib/auth/types";
import { AuthzError, AUTHZ_CODES } from "../lib/auth/types";
import {
  assertStepUpSatisfied,
  canonicalRolesForLegacy,
  isTxBuyer,
  isTxSeller,
  requireCapability as policyRequireCapability,
  requireNonGuest as policyRequireNonGuest,
  requireRole as policyRequireRole,
  requireTxBuyer as policyRequireTxBuyer,
  requireTxParticipant as policyRequireTxParticipant,
  requireTxSeller as policyRequireTxSeller,
} from "../lib/auth/policy";
import type { Capability, StepUpAction } from "../lib/auth/policy";
import { audit } from "./lib";

type Ctx = QueryCtx | MutationCtx;

/** Build the trusted principal from session + users row. */
export function toPrincipal(
  userId: string,
  user: {
    email?: string | null;
    emailVerificationTime?: number | null;
    isAnonymous?: boolean | null;
    role?: string | null;
  } | null,
): AuthenticatedPrincipal | null {
  if (!user) return null;
  return {
    userId,
    email: user.email ?? null,
    emailVerified: user.emailVerificationTime != null,
    isAnonymous: user.isAnonymous === true,
    roles: canonicalRolesForLegacy(user.role),
    legacyRole: (["user", "seller", "admin", "ops"] as const).includes(
      user.role as "user",
    )
      ? (user.role as "user" | "seller" | "admin" | "ops")
      : null,
  };
}

export async function getPrincipal(ctx: Ctx): Promise<AuthenticatedPrincipal | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  return toPrincipal(userId, user as Doc<"users"> | null);
}

function toSafeError(e: unknown): Error {
  // Never leak internals; AuthzError messages are pre-authored safe strings.
  if (e instanceof AuthzError) return new Error(e.message);
  throw e;
}

/** Authenticated NON-guest caller (Decision D). */
export async function requireNonGuestUser(ctx: MutationCtx | QueryCtx) {
  try {
    const principal = policyRequireNonGuest(await getPrincipal(ctx));
    const user = await ctx.db.get(principal.userId as never);
    if (!user) throw new Error(AUTHZ_CODES.UNAUTHENTICATED);
    return { principal, user: user as Doc<"users"> };
  } catch (e) {
    throw toSafeError(e);
  }
}

export async function requireRole(ctx: MutationCtx | QueryCtx, role: CanonicalRole) {
  try {
    const principal = policyRequireRole(await getPrincipal(ctx), role);
    const user = await ctx.db.get(principal.userId as never);
    if (!user) throw new Error(AUTHZ_CODES.UNAUTHENTICATED);
    return { principal, user: user as Doc<"users"> };
  } catch (e) {
    throw toSafeError(e);
  }
}

export async function requireCapability(
  ctx: MutationCtx | QueryCtx,
  capability: Capability,
) {
  try {
    const principal = policyRequireCapability(await getPrincipal(ctx), capability);
    const user = await ctx.db.get(principal.userId as never);
    if (!user) throw new Error(AUTHZ_CODES.UNAUTHENTICATED);
    return { principal, user: user as Doc<"users"> };
  } catch (e) {
    throw toSafeError(e);
  }
}

// ---- transaction-context guards (§5) ----

export async function requireTxParticipantFor(
  ctx: MutationCtx | QueryCtx,
  tx: { sellerId: unknown; buyerId?: unknown; _id: unknown },
  participantIds: readonly string[],
) {
  try {
    const principal = policyRequireTxParticipant(await getPrincipal(ctx), {
      sellerId: String(tx.sellerId ?? ""),
      buyerId: tx.buyerId == null ? null : String(tx.buyerId),
      participantIds,
    });
    return principal;
  } catch (e) {
    throw toSafeError(e);
  }
}

export async function requireTxSellerFor(
  ctx: MutationCtx | QueryCtx,
  tx: { sellerId: unknown },
) {
  try {
    return policyRequireTxSeller(await getPrincipal(ctx), {
      sellerId: String(tx.sellerId ?? ""),
      buyerId: null,
      participantIds: [],
    });
  } catch (e) {
    throw toSafeError(e);
  }
}

export async function requireTxBuyerFor(
  ctx: MutationCtx | QueryCtx,
  tx: { sellerId: unknown; buyerId?: unknown; _id?: unknown },
  participantIds: readonly string[],
) {
  try {
    return policyRequireTxBuyer(await getPrincipal(ctx), {
      sellerId: String(tx.sellerId ?? ""),
      buyerId: tx.buyerId == null ? null : String(tx.buyerId),
      participantIds,
    });
  } catch (e) {
    throw toSafeError(e);
  }
}

export { isTxBuyer, isTxSeller };

// ---- step-up gate (§11, Decision F) ----

/**
 * Privileged-action gate. Real MFA does not exist yet, so:
 * - production (STEP_UP_ENFORCED=true): DENY with STEP_UP_REQUIRED.
 * - development: allow but write an explicit audit record naming the bypass.
 * Never silently passes.
 */
export async function requireStepUp(
  ctx: MutationCtx,
  action: StepUpAction,
  entityId: string,
  actorId: string,
): Promise<void> {
  const enforced = process.env.STEP_UP_ENFORCED === "true";
  try {
    assertStepUpSatisfied(action, { mfaVerified: false, isProduction: enforced });
  } catch (e) {
    throw toSafeError(e);
  }
  if (!enforced) {
    await audit(ctx, {
      entityType: "security",
      entityId: entityId as never,
      actorId: actorId as never,
      action: "STEP_UP_DEFERRED",
      reason: `${action} executed without MFA (dev only; BLOCKED in production until MFA enforced)`,
    });
  }
}
