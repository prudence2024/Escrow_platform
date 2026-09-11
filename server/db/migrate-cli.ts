#!/usr/bin/env tsx
/**
 * Explicit production migration command (Phase 3, §7).
 *
 * Usage: npm run migrate [-- --dir <migrations-dir>]
 *
 * This is an INTENTIONAL manual step — application startup must never
 * auto-migrate production schema. Reads TURSO_DATABASE_URL (+ token) from
 * the environment; production without cloud config fails closed via
 * resolveDbConfig before anything connects.
 */
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbConfig } from "../config/env.js";
import { openDatabase } from "./client.js";
import { runMigrations } from "./migrate.js";

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const dirFlag = process.argv.indexOf("--dir");
  const dir =
    dirFlag >= 0 && process.argv[dirFlag + 1] !== undefined
      ? resolve(process.argv[dirFlag + 1])
      : join(here, "migrations");
  const config = resolveDbConfig(process.env);
  const client = await openDatabase(config);
  try {
    const result = await runMigrations(client, dir);
    console.log(
      JSON.stringify({
        mode: config.mode,
        applied: result.applied,
        skipped: result.skipped,
      }),
    );
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  console.error(`migrate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
