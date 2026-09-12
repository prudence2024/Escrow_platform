/**
 * Trusted role loader (Phase 6, §9–§11).
 *
 * Identity mapping (deterministic, development): the verified Convex `sub`
 * userId IS the Turso profile id — the dev importer preserves artifact IDs
 * verbatim, so no guesswork and no browser-supplied mapping. An explicit
 * persisted provider-subject mapping table remains the cutover design
 * (documented, not built here).
 *
 * Role authority during migration: Convex role state is authoritative until
 * cutover. Turso user_roles mirrors it for development API authorization
 * ONLY after role parity is established (§12). The two must never diverge
 * silently — parity failures block cutover talk.
 */
import type { Client } from "@libsql/client";
import type { RoleLoader } from "./convexJwtVerifier.js";

const CANONICAL_ROLES = [
  "buyer", "seller", "merchant", "support",
  "dispute_agent", "operations", "finance", "super_admin",
] as const;

export function tursoRoleLoader(client: Client): RoleLoader {
  return async (userId: string): Promise<string[]> => {
    const rs = await client.execute({
      sql: "SELECT role FROM user_roles WHERE profile_id = ? AND revoked_at IS NULL",
      args: [userId],
    });
    const roles: string[] = [];
    for (const row of rs.rows as Array<Record<string, unknown>>) {
      const role = String(row["role"]);
      if ((CANONICAL_ROLES as readonly string[]).includes(role)) roles.push(role);
    }
    return roles;
  };
}
