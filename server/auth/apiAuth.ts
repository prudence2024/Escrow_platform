/**
 * API authentication boundary (Phase 4, §17–§18).
 *
 * No officially supported Convex-session verification exists for a custom
 * Node server in the installed SDK (no verify/JWKS exports; no admin key in
 * env), and hand-rolled JWT verification is out of scope for a read-only
 * foundation. Therefore:
 *
 * - `ApiAuth` is the interface every protected route uses.
 * - `DenyAllAuth` is the default wiring: protected data routes answer 401
 *   in any real deployment until a verified adapter lands. Health/readiness
 *   and the slug-capability invite preview stay available by design.
 * - `TestPrincipalAuth` exists SOLELY for in-process integration tests via
 *   the app factory. It must NEVER be imported by server entry points — a
 *   structural test (`server-no-test-auth.test.ts`) fails the suite if it is.
 * - The designed future adapter is Convex token passthrough: forward the
 *   caller's bearer token to a Convex identity query and let Convex verify
 *   it. Not implemented until officially supported and reviewed.
 *
 * Never trust x-user-id / body.userId / query.userId / localStorage / roles.
 */
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";

export interface ApiAuth {
  resolvePrincipal(req: Request): Promise<AuthenticatedPrincipal | null>;
}

/** Default production-safe wiring: no verifier configured → deny. */
export class DenyAllAuth implements ApiAuth {
  async resolvePrincipal(): Promise<AuthenticatedPrincipal | null> {
    return null;
  }
}
