/**
 * DealSure provider-neutral authentication contracts (Phase 2).
 *
 * These types are intentionally framework-free: no Convex, React, or Node
 * imports, so domain logic, tests, and future server code can share them.
 * Provider specifics (Convex Auth today) live behind the AuthService
 * interface and must never leak into domain services or UI decisions.
 */

/** Canonical DealSure role vocabulary (Decision E). */
export const CANONICAL_ROLES = [
  "buyer",
  "seller",
  "merchant",
  "support",
  "dispute_agent",
  "operations",
  "finance",
  "super_admin",
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

/** Legacy Convex role values still stored in `users.role`. */
export const LEGACY_ROLES = ["user", "seller", "admin", "ops"] as const;

export type LegacyRole = (typeof LEGACY_ROLES)[number];

/**
 * The application-facing identity. Built ONLY from server-trusted state
 * (session + database row). Never from request bodies, route state,
 * localStorage, or submitted role values.
 */
export interface AuthenticatedPrincipal {
  /** Trusted database user id (string form; provider-agnostic). */
  userId: string;
  email: string | null;
  emailVerified: boolean;
  /** True for anonymous/guest sessions — sandbox powers only. */
  isAnonymous: boolean;
  /** Canonical roles resolved server-side (legacy-mapped where needed). */
  roles: CanonicalRole[];
  /** Which legacy value (if any) produced these roles — audit aid. */
  legacyRole: LegacyRole | null;
}

/** Session metadata the application is allowed to depend on. */
export interface AuthSession {
  /** True when the transport cannot report expiry (provider-managed). */
  expiryUnknown: boolean;
  /** Epoch ms when known; null when the provider manages opacity. */
  expiresAt: number | null;
  /** Whether the provider supports server-side revocation. */
  revocable: boolean;
}

/**
 * Transport-neutral auth operations. Implementations: ConvexAuthService
 * today; a future Node/API implementation later. UI and domain code depend
 * on this interface — never on provider hooks directly for decisions.
 */
export interface AuthService {
  getPrincipal(): Promise<AuthenticatedPrincipal | null>;
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

/** Machine-readable authz failure codes (see API Spec error envelope). */
export const AUTHZ_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  GUEST_BLOCKED: "GUEST_BLOCKED",
  FORBIDDEN: "FORBIDDEN",
  ROLE_REQUIRED: "ROLE_REQUIRED",
  CAPABILITY_REQUIRED: "CAPABILITY_REQUIRED",
  NOT_PARTICIPANT: "NOT_PARTICIPANT",
  STEP_UP_REQUIRED: "STEP_UP_REQUIRED",
} as const;

export type AuthzCode = (typeof AUTHZ_CODES)[keyof typeof AUTHZ_CODES];

export class AuthzError extends Error {
  readonly code: AuthzCode;
  constructor(code: AuthzCode, message: string) {
    super(message);
    this.name = "AuthzError";
    this.code = code;
  }
}
