/**
 * Convex JWT verifier adapter (Phase 5, §6).
 *
 * Mechanism (audited in installed @convex-dev/auth 0.0.95):
 * - Session tokens are RS256 JWTs: iss = CONVEX_SITE_URL, aud = "convex",
 *   sub = "<userId>|<sessionId>", default 1h lifetime (tokens.ts).
 * - The deployment serves OIDC discovery at
 *   ${CONVEX_SITE_URL}/.well-known/openid-configuration via the official
 *   auth.addHttpRoutes() surface — a public, documented verification
 *   source, not reverse engineering.
 * - Frontend obtains the token via the official useAuthToken() hook.
 *
 * Verification (never decode-then-trust): jose.jwtVerify against the
 * deployment JWKS with issuer + audience + expiry enforced, then split sub.
 * Revocation semantics equal the Convex backend's own (unexpired JWTs are
 * bearer-valid up to 1h; sign-out stops refresh, not outstanding tokens).
 * Roles are NEVER read from the token: the optional loadRoles hook reads
 * the trusted application store (Phase 6 wires Turso user_roles).
 *
 * STATUS: implemented + tested, NOT production-wired. server.ts keeps
 * DenyAllAuth until a live Convex deployment + JWKS reachability + ops
 * review exist (classification: SUPPORTED_WITH_PROVIDER_CONFIGURATION).
 */
import { createLocalJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";

export interface JwtVerifierConfig {
  /** Expected issuer (CONVEX_SITE_URL in production use). */
  issuer: string;
  /** Expected audience ("convex" for Convex Auth session tokens). */
  audience: string;
  /** JWKS JSON (fetched from OIDC discovery by the caller/ops layer). */
  jwks: unknown;
}

export type RoleLoader = (userId: string) => Promise<string[]>;

export interface VerifiedIdentity {
  userId: string;
  sessionId: string;
  expiresAtSeconds: number;
}

export class ConvexJwtVerifier {
  private keySet: ReturnType<typeof createLocalJWKSet> | null = null;
  private config: JwtVerifierConfig;
  private loadRoles: RoleLoader;

  constructor(config: JwtVerifierConfig, loadRoles: RoleLoader = async () => []) {
    this.config = config;
    this.loadRoles = loadRoles;
  }

  private getKeys(): ReturnType<typeof createLocalJWKSet> {
    if (this.keySet === null) {
      this.keySet = createLocalJWKSet(
        this.config.jwks as Parameters<typeof createLocalJWKSet>[0],
      );
    }
    return this.keySet;
  }

  /**
   * Verify a bearer credential. Returns the identity on success, null on
   * ANY failure (missing, malformed, expired, bad signature, wrong
   * issuer/audience, malformed sub). Never throws for untrusted input.
   */
  async verifyIdentity(bearer: string | null | undefined): Promise<VerifiedIdentity | null> {
    if (bearer === null || bearer === undefined || bearer.trim() === "") return null;
    try {
      const { payload } = await jwtVerify(bearer, this.getKeys(), {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      return this.toIdentity(payload);
    } catch {
      return null;
    }
  }

  /** Build the application principal (roles from the trusted loader only). */
  async toPrincipal(bearer: string | null | undefined): Promise<AuthenticatedPrincipal | null> {
    const identity = await this.verifyIdentity(bearer);
    if (identity === null) return null;
    const roles = await this.loadRoles(identity.userId);
    return {
      userId: identity.userId,
      email: null,
      emailVerified: false,
      isAnonymous: false,
      roles: roles.filter((r) =>
        ["buyer", "seller", "merchant", "support", "dispute_agent", "operations", "finance", "super_admin"].includes(r),
      ) as AuthenticatedPrincipal["roles"],
      legacyRole: null,
    };
  }

  private toIdentity(payload: JWTPayload): VerifiedIdentity | null {
    if (typeof payload["sub"] !== "string") return null;
    const divider = payload["sub"].indexOf("|");
    if (divider <= 0) return null;
    const userId = payload["sub"].slice(0, divider);
    const sessionId = payload["sub"].slice(divider + 1);
    if (userId === "" || sessionId === "") return null;
    if (typeof payload["exp"] !== "number") return null;
    return { userId, sessionId, expiresAtSeconds: payload["exp"] };
  }
}
