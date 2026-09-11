/**
 * Convex implementation of the provider-neutral AuthService (Phase 2, §3).
 *
 * Resolves the trusted principal from the Convex Auth session + users row
 * and normalizes legacy roles through policy.ts. Domain code and the React
 * hook depend on the AuthService interface + AuthenticatedPrincipal — never
 * on Convex Auth hook internals for authorization decisions.
 */

import { QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";
import {
  type AuthenticatedPrincipal,
  type AuthService,
  type AuthSession,
} from "../lib/auth/types";
import { toPrincipal } from "./authz";

export class ConvexAuthService implements AuthService {
  private ctx: QueryCtx;

  constructor(ctx: QueryCtx) {
    this.ctx = ctx;
  }

  async getPrincipal(): Promise<AuthenticatedPrincipal | null> {
    const userId = await getAuthUserId(this.ctx);
    if (!userId) return null;
    const user = await this.ctx.db.get(userId);
    return toPrincipal(userId, user as Doc<"users"> | null);
  }

  /**
   * Convex Auth manages session/token lifetimes internally; the transport
   * does not expose expiry to application code. Reported honestly so UI
   * never promises a countdown it cannot know (§9).
   */
  async getSession(): Promise<AuthSession | null> {
    const principal = await this.getPrincipal();
    if (!principal) return null;
    return { expiryUnknown: true, expiresAt: null, revocable: true };
  }

  async signOut(): Promise<void> {
    // Sign-out is executed client-side via useAuthActions().signOut()
    // (Convex Auth clears its session); server has no session to destroy
    // beyond that. Kept to satisfy the transport-neutral interface.
  }
}
