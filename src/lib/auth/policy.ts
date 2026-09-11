/**
 * DealSure central authorization policy (Phase 2). Framework-free pure
 * module: every function here is deterministic, side-effect-free, and
 * unit-tested. Server wrappers (Convex today, Node API later) resolve a
 * trusted AuthenticatedPrincipal and then call these guards.
 *
 * Model (Decision E + §5):
 * - buyer/seller are TRANSACTION-CONTEXT relationships (sellerId/buyerId or
 *   participant row), not global account types.
 * - support/dispute_agent/operations/finance/super_admin are GLOBAL
 *   staff/platform permissions gating capabilities.
 * - Frontend role checks are UX only; these guards are the enforcement.
 */

import type {
  AuthenticatedPrincipal,
  AuthzCode,
  CanonicalRole,
  LegacyRole,
} from "./types";
import { AuthzError, AUTHZ_CODES, LEGACY_ROLES } from "./types";

/** Explicit staff/platform capabilities (Decision §10). */
export const CAPABILITIES = [
  "SUPPORT_READ",
  "DISPUTE_REVIEW",
  "DISPUTE_RESOLVE",
  "OPERATIONS_READ",
  "OPERATIONS_WRITE",
  "FINANCE_READ",
  "REFUND_AUTHORIZE",
  "SETTLEMENT_AUTHORIZE",
  "RISK_REVIEW",
  "ROLE_MANAGE",
  "SUPER_ADMIN",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Role → capability mapping. Least privilege: no role implies another. */
export const ROLE_CAPABILITIES: Record<CanonicalRole, readonly Capability[]> = {
  buyer: [],
  seller: [],
  merchant: [],
  support: ["SUPPORT_READ"],
  dispute_agent: ["SUPPORT_READ", "DISPUTE_REVIEW", "DISPUTE_RESOLVE"],
  operations: ["SUPPORT_READ", "OPERATIONS_READ", "OPERATIONS_WRITE", "RISK_REVIEW"],
  finance: ["SUPPORT_READ", "FINANCE_READ", "REFUND_AUTHORIZE", "SETTLEMENT_AUTHORIZE"],
  super_admin: [...CAPABILITIES],
};

/**
 * Legacy → canonical compatibility mapping (Decision E).
 *
 * - user: baseline authenticated account, no capabilities.
 * - seller: seller relationship rights (merchant-compat where the domain
 *   explicitly grants it; no staff capabilities).
 * - ops: operations staff set (includes support-readable scope).
 * - admin: SUPER_ADMIN capability set as TEMPORARY elevated compatibility so
 *   current admin workflows keep functioning. This is intentionally broad and
 *   MUST be narrowed during admin mission-control work (Phase 15): existing
 *   admin accounts must be re-issued least-privilege roles. See audit event
 *   ROLE_COMPAT_ADMIN_MAPPED guidance in ConvexAuthService.
 */
export const LEGACY_ROLE_MAP: Record<LegacyRole, readonly CanonicalRole[]> = {
  user: [],
  seller: ["seller"],
  ops: ["operations"],
  admin: ["super_admin"],
};

export function isLegacyRole(value: unknown): value is LegacyRole {
  return (
    typeof value === "string" &&
    (LEGACY_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Normalize a stored legacy role to canonical roles. Unknown/forged values
 * (anything outside LEGACY_ROLES) resolve to NO roles — never to staff.
 * This is the forged-role rejection point: the database is trusted, but
 * even a corrupt value cannot escalate.
 */
export function canonicalRolesForLegacy(
  legacy: string | null | undefined,
): CanonicalRole[] {
  if (!isLegacyRole(legacy)) return [];
  return [...LEGACY_ROLE_MAP[legacy]];
}

export function capabilitiesForRoles(roles: readonly CanonicalRole[]): Set<Capability> {
  const out = new Set<Capability>();
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role] ?? []) out.add(cap);
  }
  return out;
}

export function principalHasCapability(
  principal: AuthenticatedPrincipal,
  capability: Capability,
): boolean {
  return capabilitiesForRoles(principal.roles).has(capability);
}

export function principalHasRole(
  principal: AuthenticatedPrincipal,
  role: CanonicalRole,
): boolean {
  return principal.roles.includes(role);
}

// ---- guards (throw AuthzError; server wrappers convert to safe errors) ----

export function requireAuthenticated(
  principal: AuthenticatedPrincipal | null,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new AuthzError(AUTHZ_CODES.UNAUTHENTICATED, "Authentication required");
  }
  return principal;
}

/**
 * Guest/sandbox block (Decision D). Anonymous principals may read demo
 * content but must never perform consequential operations.
 */
export function requireNonGuest(
  principal: AuthenticatedPrincipal | null,
  action = "this action",
): AuthenticatedPrincipal {
  const p = requireAuthenticated(principal);
  if (p.isAnonymous) {
    throw new AuthzError(
      AUTHZ_CODES.GUEST_BLOCKED,
      `Guest accounts cannot perform ${action}. Please sign in.`,
    );
  }
  return p;
}

export function requireRole(
  principal: AuthenticatedPrincipal | null,
  role: CanonicalRole,
): AuthenticatedPrincipal {
  const p = requireAuthenticated(principal);
  if (!principalHasRole(p, role)) {
    throw new AuthzError(
      AUTHZ_CODES.ROLE_REQUIRED,
      "Insufficient permissions",
    );
  }
  return p;
}

export function requireCapability(
  principal: AuthenticatedPrincipal | null,
  capability: Capability,
): AuthenticatedPrincipal {
  const p = requireAuthenticated(principal);
  if (!principalHasCapability(p, capability)) {
    throw new AuthzError(
      AUTHZ_CODES.CAPABILITY_REQUIRED,
      "Insufficient permissions",
    );
  }
  return p;
}

// ---- transaction-context relationships (§5) ----

export interface TransactionMembership {
  sellerId: string | null;
  buyerId: string | null;
  participantIds: readonly string[];
}

export function isTxSeller(
  principal: AuthenticatedPrincipal,
  tx: TransactionMembership,
): boolean {
  return tx.sellerId !== null && tx.sellerId === principal.userId;
}

export function isTxBuyer(
  principal: AuthenticatedPrincipal,
  tx: TransactionMembership,
): boolean {
  if (tx.buyerId !== null && tx.buyerId === principal.userId) return true;
  return tx.participantIds.includes(principal.userId);
}

export function isTxParticipant(
  principal: AuthenticatedPrincipal,
  tx: TransactionMembership,
): boolean {
  return (
    isTxSeller(principal, tx) ||
    isTxBuyer(principal, tx) ||
    principalHasCapability(principal, "SUPPORT_READ")
  );
}

export function requireTxParticipant(
  principal: AuthenticatedPrincipal | null,
  tx: TransactionMembership,
): AuthenticatedPrincipal {
  const p = requireAuthenticated(principal);
  if (!isTxParticipant(p, tx)) {
    throw new AuthzError(
      AUTHZ_CODES.NOT_PARTICIPANT,
      "You do not have access to this transaction",
    );
  }
  return p;
}

export function requireTxSeller(
  principal: AuthenticatedPrincipal | null,
  tx: TransactionMembership,
): AuthenticatedPrincipal {
  const p = requireAuthenticated(principal);
  if (!isTxSeller(p, tx)) {
    throw new AuthzError(AUTHZ_CODES.FORBIDDEN, "Only the seller can do this");
  }
  return p;
}

export function requireTxBuyer(
  principal: AuthenticatedPrincipal | null,
  tx: TransactionMembership,
): AuthenticatedPrincipal {
  const p = requireAuthenticated(principal);
  if (!isTxBuyer(p, tx)) {
    throw new AuthzError(AUTHZ_CODES.FORBIDDEN, "Only the buyer can do this");
  }
  return p;
}

// ---- step-up authentication registry (§11) ----

/**
 * Privileged actions requiring step-up MFA before production use.
 * Enforcement status: BLOCKED pending an MFA-capable authenticator
 * (Decision F). `assertStepUpSatisfied` documents the gate; the Convex
 * wrapper denies these paths in production mode and audit-logs dev use.
 */
export const STEP_UP_ACTIONS = [
  "role.change",
  "refund.approve",
  "settlement.authorize",
  "payout_destination.change",
  "dispute.resolve_high_value",
  "super_admin.action",
] as const;

export type StepUpAction = (typeof STEP_UP_ACTIONS)[number];

export interface StepUpContext {
  /** True only when a real MFA/step-up attestation was verified. */
  mfaVerified: boolean;
  /** True in production deployments (fail closed); false in dev. */
  isProduction: boolean;
}

export function assertStepUpSatisfied(
  action: StepUpAction,
  ctx: StepUpContext,
): void {
  if (ctx.mfaVerified) return;
  if (ctx.isProduction) {
    const code: AuthzCode = AUTHZ_CODES.STEP_UP_REQUIRED;
    throw new AuthzError(
      code,
      `Step-up authentication required for ${action}; production access is blocked until MFA is enforced`,
    );
  }
  // Development: allowed so work can continue, but callers MUST audit-log
  // the bypass (see Convex wrapper `requireStepUp`).
}
