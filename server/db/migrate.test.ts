/**
 * Clean-migration tests (Phase 3, §40).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import {
  appliedMigrations,
  loadMigrations,
  MigrationChecksumError,
  runMigrations,
} from "./migrate.js";
import {
  copyMigrationsToTemp,
  openTestDb,
  removeTempDir,
  REPO_MIGRATIONS_DIR,
} from "./testUtils.js";

let client: Client | null = null;

beforeEach(async () => {
  client = await openTestDb();
});

afterEach(() => {
  client?.close();
  client = null;
});

function db(): Client {
  if (!client) throw new Error("no test db");
  return client;
}

describe("migration runner", () => {
  it("loads 10 ordered migrations", () => {
    const files = loadMigrations(REPO_MIGRATIONS_DIR);
    expect(files.map((f) => f.version)).toEqual([
      "001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012",
    ]);
  });

  it("fresh DB migrates fully and records every version", async () => {
    const result = await runMigrations(db(), REPO_MIGRATIONS_DIR);
    expect(result.applied).toHaveLength(12);
    expect(result.skipped).toHaveLength(0);
    const applied = await appliedMigrations(db());
    expect(applied.size).toBe(12);
    for (const [version, record] of applied) {
      expect(record.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(record.filename.startsWith(version)).toBe(true);
    }
  });

  it("creates the expected tables", async () => {
    await runMigrations(db(), REPO_MIGRATIONS_DIR);
    const rs = await db().execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const names = new Set(rs.rows.map((r) => String((r as Record<string, unknown>)["name"])));
    for (const expected of [
      "_schema_migrations",
      "profiles", "user_roles",
      "transactions", "transaction_participants", "transaction_items",
      "transaction_media", "transaction_status_history",
      "payment_intents", "payment_events", "provider_webhook_events",
      "deliveries", "delivery_events", "delivery_otps",
      "transaction_threads", "transaction_messages", "message_attachments", "message_read_states",
      "disputes", "dispute_messages", "dispute_evidence",
      "ledger_accounts", "ledger_transactions", "ledger_entries",
      "settlements", "refunds", "idempotency_keys",
      "notifications", "audit_logs", "risk_flags", "admin_notes",
      "terms_versions", "terms_acceptances", "kyc_profiles", "bank_accounts",
    ]) {
      expect(names.has(expected), `missing table ${expected}`).toBe(true);
    }
  });

  it("installs the append-only guard triggers (011)", async () => {
    await runMigrations(db(), REPO_MIGRATIONS_DIR);
    const rs = await db().execute(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
    );
    const names = rs.rows.map((r) => String((r as Record<string, unknown>)["name"]));
    expect(names).toHaveLength(12);
    for (const prefix of [
      "trg_ledger_transactions",
      "trg_ledger_entries",
      "trg_audit_logs",
      "trg_payment_events",
      "trg_status_history",
      "trg_delivery_events",
    ]) {
      expect(names).toContain(`${prefix}_no_update`);
      expect(names).toContain(`${prefix}_no_delete`);
    }
  });

  it("rerun applies nothing (idempotent, no reapplication)", async () => {    await runMigrations(db(), REPO_MIGRATIONS_DIR);
    const second = await runMigrations(db(), REPO_MIGRATIONS_DIR);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toHaveLength(12);
  });

  it("modified applied migration fails loudly (checksum)", async () => {
    const dir = copyMigrationsToTemp();
    const drifted = await openTestDb();
    try {
      const first = await runMigrations(drifted, dir);
      expect(first.applied).toHaveLength(12);
      // Edit an already-applied file (simulates history tampering).
      const victim = join(dir, "002_transactions.sql");
      writeFileSync(victim, "\n-- tampered after apply\n", { flag: "a" });
      await expect(runMigrations(drifted, dir)).rejects.toThrow(MigrationChecksumError);
      // The database is untouched by the refused run: still 10 records.
      const applied = await appliedMigrations(drifted);
      expect(applied.size).toBe(12);
    } finally {
      drifted.close();
      removeTempDir(dir);
    }
  });
});
