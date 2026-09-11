/**
 * Client principal mapping tests (Phase 2, §3). The mapping is UX-only;
 * these tests pin the translation so UI role display can never silently
 * grant staff appearance from forged values.
 */
import { describe, expect, it } from "vitest";
import { toConvexPrincipal } from "./client";

describe("toConvexPrincipal", () => {
  it("maps a verified non-anonymous user", () => {
    const p = toConvexPrincipal({
      _id: "abc123",
      email: "a@example.com",
      emailVerificationTime: 123,
      isAnonymous: false,
      role: "seller",
    });
    expect(p.userId).toBe("abc123");
    expect(p.emailVerified).toBe(true);
    expect(p.isAnonymous).toBe(false);
    expect(p.roles).toEqual(["seller"]);
    expect(p.legacyRole).toBe("seller");
  });

  it("marks anonymous sessions and unverified email", () => {
    const p = toConvexPrincipal({
      _id: "anon1",
      email: null,
      emailVerificationTime: null,
      isAnonymous: true,
    });
    expect(p.isAnonymous).toBe(true);
    expect(p.emailVerified).toBe(false);
    expect(p.roles).toEqual([]);
  });

  it("downgrades unknown roles to zero roles (forged input safe)", () => {
    const p = toConvexPrincipal({ _id: "x", role: "super_admin" });
    expect(p.roles).toEqual([]);
    expect(p.legacyRole).toBeNull();
  });
});
