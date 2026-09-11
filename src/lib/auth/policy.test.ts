/**
 * Authorization policy tests (Phase 2, §14). Pure policy.ts guards —
 * the same functions the server wrappers enforce.
 */
import { describe, expect, it } from "vitest";
import {
  assertStepUpSatisfied,
  capabilitiesForRoles,
  canonicalRolesForLegacy,
  isTxBuyer,
  isTxParticipant,
  isTxSeller,
  principalHasCapability,
  requireCapability,
  requireNonGuest,
  requireRole,
  requireTxBuyer,
  requireTxParticipant,
  requireTxSeller,
} from "./policy";
import type { AuthenticatedPrincipal } from "./types";
import { AUTHZ_CODES, AuthzError } from "./types";

function principal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    userId: "user_a",
    email: "a@example.com",
    emailVerified: true,
    isAnonymous: false,
    roles: [],
    legacyRole: "user",
    ...overrides,
  };
}

const guest = () => principal({ userId: "guest_1", isAnonymous: true, legacyRole: null });
const sellerUser = () => principal({ roles: ["seller"], legacyRole: "seller" });
const supportUser = () => principal({ userId: "staff_s", roles: ["support"] });
const disputeAgent = () => principal({ userId: "staff_d", roles: ["dispute_agent"] });
const financeUser = () => principal({ userId: "staff_f", roles: ["finance"] });
const superAdmin = () => principal({ userId: "staff_sa", roles: ["super_admin"] });

const txAB = {
  sellerId: "user_a",
  buyerId: "user_b",
  participantIds: ["user_b"] as readonly string[],
};

describe("unauthenticated callers", () => {
  it("cannot pass any guard", () => {
    expect(() => requireNonGuest(null)).toThrowError(AuthzError);
    expect(() => requireRole(null, "support")).toThrowError(AuthzError);
    expect(() => requireCapability(null, "FINANCE_READ")).toThrowError(AuthzError);
    expect(() => requireTxParticipant(null, txAB)).toThrowError(AuthzError);
    try {
      requireNonGuest(null);
      expect.unreachable();
    } catch (e) {
      expect((e as AuthzError).code).toBe(AUTHZ_CODES.UNAUTHENTICATED);
    }
  });
});

describe("guest (anonymous) sandbox", () => {
  it("is blocked from consequential actions", () => {
    try {
      requireNonGuest(guest(), "create transaction");
      expect.unreachable();
    } catch (e) {
      expect((e as AuthzError).code).toBe(AUTHZ_CODES.GUEST_BLOCKED);
    }
  });

  it("holds no capabilities even if a legacy value were present", () => {
    expect(capabilitiesForRoles(guest().roles).size).toBe(0);
  });
});

describe("legacy role compatibility mapping", () => {
  it("maps documented legacy values", () => {
    expect(canonicalRolesForLegacy("user")).toEqual([]);
    expect(canonicalRolesForLegacy("seller")).toEqual(["seller"]);
    expect(canonicalRolesForLegacy("ops")).toEqual(["operations"]);
    expect(canonicalRolesForLegacy("admin")).toEqual(["super_admin"]);
  });

  it("rejects forged/unknown role input to zero roles (no escalation)", () => {
    for (const forged of [
      "super_admin",
      "finance",
      "admin ",
      "ADMIN",
      "admin'; DROP TABLE users;--",
      "",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(canonicalRolesForLegacy(forged as string)).toEqual([]);
    }
  });
});

describe("transaction-context roles", () => {
  it("seller is seller only in their own transaction (forged userId fails)", () => {
    expect(isTxSeller(sellerUser(), txAB)).toBe(true);
    expect(isTxSeller(principal({ userId: "user_b" }), txAB)).toBe(false);
    expect(isTxBuyer(principal({ userId: "user_b" }), txAB)).toBe(true);
    expect(isTxBuyer(sellerUser(), txAB)).toBe(false);
  });

  it("buyer cannot perform seller-only actions and vice versa", () => {
    expect(() => requireTxSeller(principal({ userId: "user_b" }), txAB)).toThrowError(
      AuthzError,
    );
    expect(() =>
      requireTxBuyer(principal({ userId: "user_a" }), {
        ...txAB,
        participantIds: [],
      }),
    ).toThrowError(AuthzError);
  });

  it("unrelated user A cannot touch user B's transaction", () => {
    const stranger = principal({ userId: "user_stranger" });
    expect(isTxParticipant(stranger, txAB)).toBe(false);
    expect(() => requireTxParticipant(stranger, txAB)).toThrowError(AuthzError);
  });

  it("staff may view via support scope, guests of staff cannot", () => {
    expect(isTxParticipant(supportUser(), txAB)).toBe(true);
  });
});

describe("staff least privilege", () => {
  it("normal user cannot perform staff actions", () => {
    expect(() => requireCapability(principal(), "FINANCE_READ")).toThrowError(AuthzError);
    expect(() => requireRole(principal(), "support")).toThrowError(AuthzError);
  });

  it("support cannot perform finance actions", () => {
    expect(principalHasCapability(supportUser(), "SUPPORT_READ")).toBe(true);
    expect(principalHasCapability(supportUser(), "REFUND_AUTHORIZE")).toBe(false);
    expect(() =>
      requireCapability(supportUser(), "SETTLEMENT_AUTHORIZE"),
    ).toThrowError(AuthzError);
  });

  it("dispute_agent cannot manage roles (super-admin only)", () => {
    expect(principalHasCapability(disputeAgent(), "DISPUTE_RESOLVE")).toBe(true);
    expect(principalHasCapability(disputeAgent(), "ROLE_MANAGE")).toBe(false);
    expect(() => requireCapability(disputeAgent(), "ROLE_MANAGE")).toThrowError(
      AuthzError,
    );
  });

  it("finance cannot manage roles; super_admin can do everything", () => {
    expect(principalHasCapability(financeUser(), "REFUND_AUTHORIZE")).toBe(true);
    expect(principalHasCapability(financeUser(), "ROLE_MANAGE")).toBe(false);
    expect(principalHasCapability(superAdmin(), "ROLE_MANAGE")).toBe(true);
    expect(principalHasCapability(superAdmin(), "SUPER_ADMIN")).toBe(true);
  });
});

describe("step-up gate honesty", () => {
  it("denies production privileged actions without MFA", () => {
    expect(() =>
      assertStepUpSatisfied("refund.approve", { mfaVerified: false, isProduction: true }),
    ).toThrowError(AuthzError);
    try {
      assertStepUpSatisfied("role.change", { mfaVerified: false, isProduction: true });
      expect.unreachable();
    } catch (e) {
      expect((e as AuthzError).code).toBe(AUTHZ_CODES.STEP_UP_REQUIRED);
    }
  });

  it("passes with real MFA attestation or in dev (audited by caller)", () => {
    expect(() =>
      assertStepUpSatisfied("refund.approve", { mfaVerified: true, isProduction: true }),
    ).not.toThrow();
    expect(() =>
      assertStepUpSatisfied("role.change", { mfaVerified: false, isProduction: false }),
    ).not.toThrow();
  });
});
