/**
 * API server configuration (Phase 4, §10).
 * Extends the Phase 3 DB env with API concerns. Production fails closed
 * via resolveDbConfig; API settings always have safe defaults.
 */

export interface ServerConfig {
  port: number;
  corsAllowedOrigins: string[];
  isProduction: boolean;
  isTest: boolean;
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 3001;
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${raw}`);
  }
  return port;
}

function parseOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") return [];
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const origin of origins) {
    if (origin === "*") {
      throw new Error("CORS_ALLOWED_ORIGINS must not contain '*' for credentialed APIs");
    }
    if (!/^https?:\/\/[^/]+$/.test(origin)) {
      throw new Error(`Invalid CORS origin (scheme://host only): ${origin}`);
    }
  }
  return origins;
}

export function resolveServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const nodeEnv = (env["NODE_ENV"] ?? "").toLowerCase();
  return {
    port: parsePort(env["API_PORT"]),
    corsAllowedOrigins: parseOrigins(env["CORS_ALLOWED_ORIGINS"]),
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
  };
}
