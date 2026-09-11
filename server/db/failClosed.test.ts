/**
 * Production fail-closed + seed-safety tests (Phase 3, §44–§45, §5).
 * Proving a negative (no silent local/in-memory fallback, no stray files)
 * by asserting loud configuration errors and an empty temp directory.
 */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import {
  DbConfigError,
  resolveDbConfig,
} from "../config/env.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "./testUtils.js";
import { runMigrations } from "./migrate.js";
import { runDevSeed } from "./seed/dev.js";

describe("production fail-closed", () => {
  it("refuses production without Turso configuration", () => {
    expect(() => resolveDbConfig({ NODE_ENV: "production" })).toThrow(DbConfigError);
    expect(() =>
      resolveDbConfig({ NODE_ENV: "production", TURSO_DATABASE_URL: "" }),
    ).toThrow(DbConfigError);
  });

  it("refuses local/in-memory URLs in production", () => {
    for (const url of [":memory:", "file:./local.db", "file:/tmp/x.db", "sqlite://x"]) {
      expect(() =>
        resolveDbConfig({ NODE_ENV: "production", TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "t" }),
      ).toThrow(DbConfigError);
    }
  });

  it("refuses cloud URL without auth token in production", () => {
    expect(() =>
      resolveDbConfig({ NODE_ENV: "production", TURSO_DATABASE_URL: "libsql://db.example.com" }),
    ).toThrow(DbConfigError);
  });

  it("accepts a complete production cloud configuration", () => {
    const config = resolveDbConfig({
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://db.example.com",
      TURSO_AUTH_TOKEN: "token",
    });
    expect(config.mode).toBe("turso");
    expect(config.isProductionCloud).toBe(true);
  });

  it("creates no database files when production config is rejected", () => {
    const dir = mkdtempSync(join(tmpdir(), "dealsure-failclosed-"));
    try {
      expect(() => resolveDbConfig({ NODE_ENV: "production" })).toThrow(DbConfigError);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("defaults safely outside production (memory, no hidden cloud)", () => {
    expect(resolveDbConfig({}).mode).toBe("memory");
    expect(resolveDbConfig({ NODE_ENV: "development" }).mode).toBe("memory");
    expect(
      resolveDbConfig({ TURSO_DATABASE_URL: "file:./dev.db" }).mode,
    ).toBe("file");
  });
});

describe("seed safety", () => {
  it("development seed refuses production unconditionally", async () => {
    const client: Client = await openTestDb();
    try {
      await runMigrations(client, REPO_MIGRATIONS_DIR);
      await expect(
        runDevSeed(client, { NODE_ENV: "production" }),
      ).rejects.toThrow(DbConfigError);
      const rs = await client.execute("SELECT count(*) AS c FROM transactions");
      expect(Number((rs.rows[0] as Record<string, unknown>)["c"])).toBe(0);
    } finally {
      client.close();
    }
  });

  it("development seed covers the representative lifecycle states", async () => {
    const client: Client = await openTestDb();
    try {
      await runMigrations(client, REPO_MIGRATIONS_DIR);
      const created = await runDevSeed(client, {});
      expect(created).toHaveLength(11);
      const rs = await client.execute(
        "SELECT status, count(*) AS c FROM transactions GROUP BY status ORDER BY status",
      );
      const byStatus = new Map(
        (rs.rows as Array<Record<string, unknown>>).map((r) => [String(r["status"]), Number(r["c"])]),
      );
      for (const status of [
        "DRAFT", "AWAITING_PAYMENT", "PAYMENT_SECURED", "DISPATCHED",
        "DELIVERED_PENDING_INSPECTION", "ACCEPTED", "SETTLED", "DISPUTED",
        "REFUND_PENDING", "REFUNDED", "CANCELLED",
      ]) {
        expect(byStatus.get(status), `seeded status ${status}`).toBe(1);
      }
    } finally {
      client.close();
    }
  });

  it("seeded journals balance (debits equal credits per journal)", async () => {
    const client: Client = await openTestDb();
    try {
      await runMigrations(client, REPO_MIGRATIONS_DIR);
      await runDevSeed(client, {});
      const rs = await client.execute(
        `SELECT lt.id AS j, COALESCE(SUM(le.debit_minor), 0) AS d, COALESCE(SUM(le.credit_minor), 0) AS c
         FROM ledger_transactions lt LEFT JOIN ledger_entries le ON le.ledger_transaction_id = lt.id
         GROUP BY lt.id`,
      );
      expect(rs.rows.length).toBeGreaterThan(0);
      for (const row of rs.rows as Array<Record<string, unknown>>) {
        expect(Number(row["d"]), `journal ${String(row["j"])} balances`).toBe(Number(row["c"]));
      }
    } finally {
      client.close();
    }
  });
});
