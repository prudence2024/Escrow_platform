/**
 * Convex bearer authentication for development wiring (Phase 6, §4–§7).
 *
 * Builds an ApiAuth backed by ConvexJwtVerifier with provider metadata from
 * TRUSTED SERVER CONFIGURATION ONLY:
 * - CONVEX_ISSUER_URL (required, explicit — never guessed, never from requests)
 * - CONVEX_AUDIENCE (default "convex", the audited Convex Auth value)
 *
 * Startup behavior: OIDC discovery + JWKS fetch failures are FATAL (throw) —
 * the server never starts in a degraded "auth-ish" state. Request behavior:
 * ONLY `Authorization: Bearer <token>` is read; query/body/custom headers
 * are never credentials. Every verification failure resolves to null (401).
 */
import { ConvexJwtVerifier, type RoleLoader } from "./convexJwtVerifier.js";
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";
import type { ApiAuth } from "./apiAuth.js";

export interface ConvexAuthConfig {
  issuerUrl: string;
  audience: string;
}

export class ConvexAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConvexAuthConfigError";
  }
}

type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

const DISCOVERY_TIMEOUT_MS = 10_000;

export function resolveConvexAuthConfig(
  env: Record<string, string | undefined>,
): ConvexAuthConfig {
  const issuerUrl = (env["CONVEX_ISSUER_URL"] ?? "").trim();
  if (issuerUrl === "") {
    throw new ConvexAuthConfigError(
      "API_AUTH_MODE=convex requires CONVEX_ISSUER_URL (explicit Convex deployment issuer; never guessed).",
    );
  }
  if (!/^https:\/\//.test(issuerUrl)) {
    throw new ConvexAuthConfigError("CONVEX_ISSUER_URL must be an https:// URL.");
  }
  const audience = (env["CONVEX_AUDIENCE"] ?? "").trim() || "convex";
  return { issuerUrl: issuerUrl.replace(/\/$/, ""), audience };
}

async function fetchJson(url: string, fetchFn: FetchFn, what: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) {
      throw new ConvexAuthConfigError(`${what} failed: HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof ConvexAuthConfigError) throw error;
    throw new ConvexAuthConfigError(
      `${what} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch OIDC discovery + JWKS using only trusted server configuration. */
export async function fetchConvexJwks(
  config: ConvexAuthConfig,
  fetchFn: FetchFn = fetch,
): Promise<unknown> {
  const discovery = (await fetchJson(
    `${config.issuerUrl}/.well-known/openid-configuration`,
    fetchFn,
    "OIDC discovery",
  )) as Record<string, unknown>;
  const jwksUri = discovery["jwks_uri"];
  if (typeof jwksUri !== "string" || jwksUri === "") {
    throw new ConvexAuthConfigError("OIDC discovery response has no jwks_uri");
  }
  const jwks = (await fetchJson(jwksUri, fetchFn, "JWKS fetch")) as Record<string, unknown>;
  if (!Array.isArray(jwks["keys"]) || jwks["keys"].length === 0) {
    throw new ConvexAuthConfigError("JWKS response has no keys");
  }
  return jwks;
}

function bearerFrom(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer (.+)$/.exec(header.trim());
  return match === null ? null : match[1];
}

/**
 * Build theConvex-backed ApiAuth. Discovery/JWKS failures throw (startup
 * fatal). The returned adapter resolves principals from bearer tokens only.
 */
export async function createConvexAuth(
  env: Record<string, string | undefined>,
  loadRoles: RoleLoader,
  fetchFn: FetchFn = fetch,
): Promise<ApiAuth> {
  const config = resolveConvexAuthConfig(env);
  const jwks = await fetchConvexJwks(config, fetchFn);
  const verifier = new ConvexJwtVerifier(
    { issuer: config.issuerUrl, audience: config.audience, jwks },
    loadRoles,
  );
  return {
    resolvePrincipal: async (req: Request): Promise<AuthenticatedPrincipal | null> =>
      verifier.toPrincipal(bearerFrom(req)),
  };
}
