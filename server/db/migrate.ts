/**
 * DealSure migration runner (Phase 3, §7).
 *
 * - Ordered `NNN_name.sql` files; version = leading numeric prefix.
 * - Tracking table `_schema_migrations(version, filename, checksum, applied_at)`.
 * - Each migration applies atomically (BEGIN/COMMIT around the file).
 * - Applied migrations are never rerun; a checksum change on an applied
 *   migration is a LOUD failure (edit history via new files, never edits).
 * - Migration files must be plain DDL/DML and must NOT manage transactions.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@libsql/client";

export interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export class MigrationChecksumError extends Error {
  constructor(version: string, filename: string) {
    super(
      `Migration ${version} (${filename}) was MODIFIED after being applied. ` +
        `Migrations are immutable: create a new migration file instead.`,
    );
    this.name = "MigrationChecksumError";
  }
}

export class MigrationApplyError extends Error {
  constructor(version: string, cause: unknown) {
    super(`Migration ${version} failed and was rolled back: ${String(cause)}`);
    this.name = "MigrationApplyError";
  }
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Load and order migration files from a directory (pure filesystem read). */
export function loadMigrations(dir: string): MigrationFile[] {
  const names = readdirSync(dir)
    .filter((n) => /^\d+_.+\.sql$/.test(n))
    .sort();
  const seen = new Set<string>();
  return names.map((filename) => {
    const version = filename.split("_")[0];
    if (seen.has(version)) {
      throw new Error(`Duplicate migration version: ${version}`);
    }
    seen.add(version);
    const sql = readFileSync(join(dir, filename), "utf8");
    return { version, filename, sql, checksum: sha256Hex(sql) };
  });
}

export async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    ) STRICT`,
  );
}

export async function appliedMigrations(
  client: Client,
): Promise<Map<string, { filename: string; checksum: string }>> {
  const rs = await client.execute(
    "SELECT version, filename, checksum FROM _schema_migrations",
  );
  const out = new Map<string, { filename: string; checksum: string }>();
  for (const row of rs.rows as unknown as Array<Record<string, unknown>>) {
    out.set(String(row["version"]), {
      filename: String(row["filename"]),
      checksum: String(row["checksum"]),
    });
  }
  return out;
}

export async function runMigrations(
  client: Client,
  dir: string,
  nowMs: number = Date.now(),
): Promise<MigrationResult> {
  const files = loadMigrations(dir);
  await ensureMigrationsTable(client);
  const applied = await appliedMigrations(client);
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of files) {
    const record = applied.get(file.version);
    if (record !== undefined) {
      if (record.checksum !== file.checksum) {
        throw new MigrationChecksumError(file.version, file.filename);
      }
      result.skipped.push(file.version);
      continue;
    }
    const tx = await client.transaction();
    try {
      await tx.executeMultiple(file.sql);
      await tx.execute({
        sql: "INSERT INTO _schema_migrations (version, filename, checksum, applied_at) VALUES (?, ?, ?, ?)",
        args: [file.version, file.filename, file.checksum, nowMs],
      });
      await tx.commit();
    } catch (cause) {
      try {
        await tx.rollback();
      } catch {
        // Best effort: surface the original failure.
      }
      throw new MigrationApplyError(file.version, cause);
    }
    result.applied.push(file.version);
  }
  return result;
}
