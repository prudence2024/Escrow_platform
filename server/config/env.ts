/**
 * DealSure server database configuration (Phase 3).
 *
 * Modes (selected ONLY through TURSO_DATABASE_URL scheme):
 * - `libsql://…` / `https://…` → Turso cloud (requires TURSO_AUTH_TOKEN
 *   unless the URL carries no auth need — enforced per scheme below).
 * - `file:<path>` / `file:relative.db` → local SQLite/libSQL file (dev/test).
 * - `:memory:` (or unset outside production) → in-memory (tests/dev default).
 *
 * PRODUCTION FAIL-CLOSED RULES (§5, §44):
 * - NODE_ENV=production REQUIRES TURSO_DATABASE_URL with a cloud scheme.
 * - file:/:memory: in production → throw. Missing config → throw.
 * - Nothing in this module creates files or connections as a side effect;
 *   resolution is pure and unit-tested. The client is opened explicitly.
 */

export type DbMode = "turso" | "file" | "memory";

export interface DbConfig {
  mode: DbMode;
  /** Exact URL handed to @libsql/client. */
  url: string;
  /** Cloud auth token; undefined for local modes. */
  authToken: string | undefined;
  /** True only for production cloud mode. */
  isProductionCloud: boolean;
}

export class DbConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbConfigError";
  }
}

export interface DbEnv {
  NODE_ENV?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

function isProduction(env: DbEnv): boolean {
  return (env.NODE_ENV ?? "").toLowerCase() === "production";
}

function isCloudScheme(url: string): boolean {
  return url.startsWith("libsql://") || url.startsWith("https://");
}

function isLocalScheme(url: string): boolean {
  return url.startsWith("file:") || url === ":memory:";
}

/**
 * Resolve database configuration. Pure: reads only the supplied env mapping
 * (defaults to process.env), touches no filesystem or network.
 */
export function resolveDbConfig(env: DbEnv = process.env): DbConfig {
  const production = isProduction(env);
  const rawUrl = (env.TURSO_DATABASE_URL ?? "").trim();
  const token = (env.TURSO_AUTH_TOKEN ?? "").trim() || undefined;

  if (production) {
    if (!rawUrl) {
      throw new DbConfigError(
        "NODE_ENV=production requires TURSO_DATABASE_URL (cloud Turso). Refusing to fall back to local/in-memory storage.",
      );
    }
    if (!isCloudScheme(rawUrl)) {
      throw new DbConfigError(
        `NODE_ENV=production forbids local database URL (${describeScheme(rawUrl)}). Configure a cloud Turso URL.`,
      );
    }
    if (!token) {
      throw new DbConfigError(
        "NODE_ENV=production with a cloud Turso URL requires TURSO_AUTH_TOKEN.",
      );
    }
    return { mode: "turso", url: rawUrl, authToken: token, isProductionCloud: true };
  }

  // Non-production: explicit URL wins; otherwise safe in-memory default.
  if (!rawUrl) {
    return { mode: "memory", url: ":memory:", authToken: undefined, isProductionCloud: false };
  }
  if (isCloudScheme(rawUrl)) {
    return { mode: "turso", url: rawUrl, authToken: token, isProductionCloud: false };
  }
  if (isLocalScheme(rawUrl)) {
    return { mode: rawUrl === ":memory:" ? "memory" : "file", url: rawUrl, authToken: undefined, isProductionCloud: false };
  }
  throw new DbConfigError(
    `Unsupported TURSO_DATABASE_URL scheme (${describeScheme(rawUrl)}). Use libsql(s)://, file:, or :memory:.`,
  );
}

function describeScheme(url: string): string {
  const cut = url.indexOf(":");
  return cut < 0 ? "(empty)" : url.slice(0, cut + 1);
}

/**
 * Development-seed guard (§38, §45). Throws unless explicitly safe:
 * never in production, regardless of other flags.
 */
export function assertDevSeedAllowed(env: DbEnv = process.env): void {
  if (isProduction(env)) {
    throw new DbConfigError(
      "Development seed is forbidden when NODE_ENV=production.",
    );
  }
}
