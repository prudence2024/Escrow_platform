import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useMemo } from "react";
import type { AuthenticatedPrincipal } from "@/lib/auth/types";
import { toConvexPrincipal } from "@/lib/auth/client";

/**
 * Central application auth hook (Phase 2, §3).
 *
 * This is the migration seam: pages/components consume `principal`
 * (provider-neutral, canonical roles) for UX decisions and pass no identity
 * into mutations — the server re-resolves identity from the session.
 * `user` (raw Convex row) is retained for compatibility during the gradual
 * migration; new code must prefer `principal`.
 */
export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  const principal: AuthenticatedPrincipal | null | undefined = useMemo(() => {
    if (user === undefined) return undefined;
    if (user === null) return null;
    return toConvexPrincipal(user);
  }, [user]);

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    principal,
    signIn,
    signOut,
  };
}
