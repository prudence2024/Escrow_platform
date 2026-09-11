/**
 * Test-database lifecycle helpers (Phase 3, §39).
 *
 * Tests use isolated in-memory (or temp-file) databases ONLY — never a
 * shared/cloud Turso DB. Every helper creates fresh state per test.
 */
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { foreignKeysEnforced } from "./client.js";
import { runMigrations } from "./migrate.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Repository migration directory (the real, committed SQL files). */
export const REPO_MIGRATIONS_DIR = join(here, "migrations");

/** Fresh in-memory database with foreign keys enforced (verified). */
export async function openTestDb(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON");
  if (!(await foreignKeysEnforced(client))) {
    client.close();
    throw new Error("Test DB could not enforce foreign keys");
  }
  return client;
}

/** Fresh migrated database: open + apply all repo migrations. */
export async function openMigratedDb(): Promise<Client> {
  const client = await openTestDb();
  await runMigrations(client, REPO_MIGRATIONS_DIR);
  return client;
}

/**
 * Copy the repo migrations to a temp dir for destructive tests (e.g.
 * checksum-tamper). Caller must rmSync the result (recursive, force).
 */
export function copyMigrationsToTemp(): string {
  const dir = mkdtempSync(join(tmpdir(), "dealsure-migrations-"));
  cpSync(REPO_MIGRATIONS_DIR, dir, { recursive: true });
  return dir;
}

export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
