/**
 * API write-mode resolution (Phase 7, §3).
 *
 * Write mode is a separate server-side control from auth mode. Authentication
 * being enabled does NOT automatically enable writes. The default is disabled;
 * draft-development is permitted only outside production.
 *
 * Rules:
 *   disabled          — no write routes respond (default)
 *   draft-development — private draft create/edit only (dev/test only)
 *   unknown values    — configuration error / fail closed
 *
 * Production + draft-development = startup failure (not a warning).
 */

export type ApiWriteMode = "disabled" | "draft-development";

export function resolveApiWriteMode(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string = (env["NODE_ENV"] ?? "").toLowerCase(),
): ApiWriteMode {
  const raw = (env["API_WRITE_MODE"] ?? "disabled").toLowerCase();
  if (raw !== "disabled" && raw !== "draft-development") {
    throw new Error(
      `Invalid API_WRITE_MODE: "${env["API_WRITE_MODE"]}". Use "disabled" or "draft-development".`,
    );
  }
  if (raw === "draft-development" && nodeEnv === "production") {
    throw new Error(
      "API_WRITE_MODE=draft-development is not permitted in production. Use disabled.",
    );
  }
  return raw;
}
