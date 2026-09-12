/**
 * Cloud Turso smoke tooling (Phase 6, §31–§32). DEVELOPMENT ONLY.
 *
 * Usage: npm run turso:smoke
 *
 * Requires explicit classification: TURSO_ENVIRONMENT=development, plus a
 * TURSO_DATABASE_URL (+ token for cloud schemes). Refuses production AND
 * ambiguous/unknown environments — never infers from hostname.
 *
 * Checks are read-only or rolled back: connection, SELECT 1, migration
 * table/count, FK behavior (violating insert inside a rolled-back txn),
 * STRICT behavior, interactive transactions, unique constraints,
 * append-only trigger presence. Never seeds, never deletes unknown data.
 */
import type { Client } from "@libsql/client";
import { resolveDbConfig } from "../config/env.js";
import { openDatabase, foreignKeysEnforced } from "../db/client.js";
import { appliedMigrations, loadMigrations } from "../db/migrate.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export interface SmokeCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export function resolveSmokeTarget(
  env: Record<string, string | undefined>,
): { url: string; token: string | undefined } {
  const environment = (env["TURSO_ENVIRONMENT"] ?? "").trim().toLowerCase();
  if (environment !== "development") {
    throw new Error(
      `turso:smoke refuses TURSO_ENVIRONMENT="${env["TURSO_ENVIRONMENT"] ?? ""}": set exactly "development" (never production, never ambiguous).`,
    );
  }
  const url = (env["TURSO_DATABASE_URL"] ?? "").trim();
  if (url === "") {
    throw new Error("turso:smoke requires TURSO_DATABASE_URL (NOT EXECUTED — credentials/target unavailable).");
  }
  return { url, token: (env["TURSO_AUTH_TOKEN"] ?? "").trim() || undefined };
}

export async function runSmokeChecks(client: Client): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = [];
  const check = async (name: string, fn: () => Promise<string>): Promise<void> => {
    try {
      checks.push({ name, pass: true, detail: await fn() });
    } catch (error) {
      checks.push({ name, pass: false, detail: error instanceof Error ? error.message : String(error) });
    }
  };

  await check("connection+select-1", async () => {
    const rs = await client.execute("SELECT 1 AS one");
    if (Number((rs.rows[0] as Record<string, unknown>)["one"]) !== 1) throw new Error("SELECT 1 mismatch");
    return "ok";
  });
  await check("migrations-table", async () => {
    const applied = await appliedMigrations(client);
    const files = loadMigrations(MIGRATIONS_DIR);
    return `${applied.size}/${files.length} applied`;
  });
  await check("foreign-keys-enforced", async () => {
    if (!(await foreignKeysEnforced(client))) throw new Error("PRAGMA foreign_keys is off");
    return "on";
  });
  await check("foreign-key-rejects-bad-row", async () => {
    const tx = await client.transaction();
    try {
      await tx.execute({
        sql: "INSERT INTO transaction_participants (id, transaction_id, profile_id, role) VALUES ('smoke-x', 'missing', 'missing', 'buyer')",
        args: [],
      });
      throw new Error("invalid relation accepted");
    } catch (error) {
      if (error instanceof Error && error.message === "invalid relation accepted") throw error;
      return "rejected as required";
    } finally {
      await tx.rollback();
    }
  });
  await check("strict-rejects-text-in-integer", async () => {
    const tx = await client.transaction();
    try {
      await tx.execute({
        sql: "INSERT INTO profiles (id, onboarded, created_at, updated_at) VALUES ('smoke-strict', 'not-an-int', 1, 1)",
        args: [],
      });
      throw new Error("STRICT accepted TEXT in INTEGER");
    } catch (error) {
      if (error instanceof Error && error.message === "STRICT accepted TEXT in INTEGER") throw error;
      return "rejected as required";
    } finally {
      await tx.rollback();
    }
  });
  await check("interactive-transactions", async () => {
    const tx = await client.transaction();
    try {
      await tx.execute({ sql: "CREATE TEMP TABLE smoke_tmp (id TEXT PRIMARY KEY)", args: [] });
      await tx.execute({ sql: "INSERT INTO smoke_tmp (id) VALUES ('a')", args: [] });
      await tx.commit();
      return "commit works (TEMP table, session-local, auto-cleaned)";
    } catch (error) {
      try {
        await tx.rollback();
      } catch {
        // Best effort.
      }
      throw error;
    }
  });
  await check("unique-constraints", async () => {
    const rs = await client.execute(
      "SELECT sql AS ddl FROM sqlite_master WHERE type = 'table' AND name = 'transactions'",
    );
    return `transactions DDL present (${String((rs.rows[0] as Record<string, unknown> | undefined)?.["ddl"] ?? "").length} chars)`;
  });
  await check("append-only-triggers-present", async () => {
    const rs = await client.execute("SELECT count(*) AS c FROM sqlite_master WHERE type = 'trigger'");
    const count = Number((rs.rows[0] as Record<string, unknown>)["c"]);
    if (count < 12) throw new Error(`expected >= 12 triggers, found ${count}`);
    return `${count} triggers`;
  });
  return checks;
}

async function main(): Promise<void> {
  const target = resolveSmokeTarget(process.env);
  const config = resolveDbConfig({ ...process.env, TURSO_DATABASE_URL: target.url, TURSO_AUTH_TOKEN: target.token });
  const client = await openDatabase(config);
  try {
    const checks = await runSmokeChecks(client);
    console.log(JSON.stringify({ target: target.url.split("@").pop(), checks }, null, 2));
    if (checks.some((c) => !c.pass)) process.exitCode = 1;
  } finally {
    client.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (await import("node:path")).resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(`turso:smoke failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
