/**
 * API authentication modes (Phase 6, §3).
 *
 * API_AUTH_MODE=deny   — default everywhere (dev included). Protected routes 401.
 * API_AUTH_MODE=convex — explicitly configured Convex JWT verification.
 *
 * There are deliberately NO test/debug/header/mock modes: test principals
 * exist only via in-process injection in tests, never via configuration.
 * Unknown values fail closed (throw) rather than silently denying — a typo
 * must be loud, and convex must never auto-enable.
 */
export type ApiAuthMode = "deny" | "convex";

export class AuthModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthModeError";
  }
}

export function resolveApiAuthMode(env: Record<string, string | undefined>): ApiAuthMode {
  const raw = (env["API_AUTH_MODE"] ?? "").trim().toLowerCase();
  if (raw === "" || raw === "deny") return "deny";
  if (raw === "convex") return "convex";
  throw new AuthModeError(
    `Unknown API_AUTH_MODE "${env["API_AUTH_MODE"]}". Allowed: deny, convex.`,
  );
}
