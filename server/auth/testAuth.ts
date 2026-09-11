/**
 * TEST-ONLY principal injection (Phase 4, §18).
 *
 * Constructed in-process by integration tests and passed to the app factory.
 * MUST NEVER be imported by server entry points or production wiring — the
 * suite contains a structural test enforcing this. There is deliberately NO
 * header/env-based debug identity: production cannot enable this path.
 */
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";
import type { ApiAuth } from "./apiAuth.js";

export class TestPrincipalAuth implements ApiAuth {
  private principals = new Map<string, AuthenticatedPrincipal>();

  /** Register a principal under an opaque test handle (never a real id). */
  add(handle: string, principal: AuthenticatedPrincipal): void {
    this.principals.set(handle, principal);
  }

  async resolvePrincipal(req: Request): Promise<AuthenticatedPrincipal | null> {
    const handle = req.headers.get("x-test-principal");
    if (handle === null) return null;
    return this.principals.get(handle) ?? null;
  }
}

export function testPrincipal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    userId: "test-user-a",
    email: "a@example.com",
    emailVerified: true,
    isAnonymous: false,
    roles: [],
    legacyRole: "user",
    ...overrides,
  };
}
