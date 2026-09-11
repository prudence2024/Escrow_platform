/**
 * Client-side principal mapping (Phase 2, §3). UX ONLY — never authorization.
 *
 * Maps the Convex `currentUser` row to the provider-neutral principal shape
 * so components can render role-aware UI without importing provider hooks.
 * The server always re-resolves identity from the session; a forged client
 * principal grants nothing.
 */

import type { AuthenticatedPrincipal } from "./types";
import { canonicalRolesForLegacy } from "./policy";

export interface ConvexUserRow {
  _id: string;
  email?: string | null;
  emailVerificationTime?: number | null;
  isAnonymous?: boolean | null;
  role?: string | null;
}

export function toConvexPrincipal(user: ConvexUserRow): AuthenticatedPrincipal {
  const legacy = (["user", "seller", "admin", "ops"] as const).includes(
    user.role as "user",
  )
    ? (user.role as "user" | "seller" | "admin" | "ops")
    : null;
  return {
    // Convex Id<"users"> serializes as a string over the wire.
    userId: String(user._id),
    email: user.email ?? null,
    emailVerified: user.emailVerificationTime != null,
    isAnonymous: user.isAnonymous === true,
    roles: canonicalRolesForLegacy(user.role),
    legacyRole: legacy,
  };
}
