/**
 * Foreign-key enforcement tests (Phase 3, §34, §41).
 * Proves PRAGMA foreign_keys is ON and invalid relationships are rejected —
 * never merely assumed.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import { foreignKeysEnforced, openDatabase } from "./client.js";
import type { DbConfig } from "../config/env.js";
import { runMigrations } from "./migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "./testUtils.js";

const AT = 1780000000000;
let client: Client | null = null;

beforeEach(async () => {
  client = await openTestDb();
  await runMigrations(client, REPO_MIGRATIONS_DIR);
});

afterEach(() => {
  client?.close();
  client = null;
});

function db(): Client {
  if (!client) throw new Error("no test db");
  return client;
}

async function seedProfile(id: string): Promise<void> {
  await db().execute({
    sql: "INSERT INTO profiles (id, email, onboarded, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, `${id}@example.com`, 1, AT, AT],
  });
}

async function seedTx(id: string, seller: string): Promise<void> {
  await db().execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, transaction_origin, seller_id, title, description,
       category, currency, amount_minor, delivery_fee_minor, platform_fee_minor, total_minor,
       status, created_at, updated_at)
     VALUES (?, ?, ?, 'SHARE_LINK', ?, 't', 'd', 'Other', 'NGN', 5000, 0, 0, 5000, 'DRAFT', ?, ?)`,
    args: [id, `ref-${id}`, `slug-${id}-aaaa`, seller, AT, AT],
  });
}

describe("foreign keys", () => {
  it("are enforced on every opened connection", async () => {
    const config: DbConfig = { mode: "memory", url: ":memory:", authToken: undefined, isProductionCloud: false };
    const c = await openDatabase(config);
    try {
      expect(await foreignKeysEnforced(c)).toBe(true);
    } finally {
      c.close();
    }
  });

  it("rejects participant -> missing transaction", async () => {
    await seedProfile("p1");
    await expect(
      db().execute({
        sql: "INSERT INTO transaction_participants (id, transaction_id, profile_id, role) VALUES ('x', 'nope', 'p1', 'buyer')",
        args: [],
      }),
    ).rejects.toThrow();
  });

  it("rejects item -> missing transaction", async () => {
    await expect(
      db().execute({
        sql: "INSERT INTO transaction_items (id, transaction_id, name, quantity, unit_amount_minor) VALUES ('x', 'nope', 'n', 1, 0)",
        args: [],
      }),
    ).rejects.toThrow();
  });

  it("rejects payment -> missing transaction", async () => {
    await seedProfile("p1");
    await expect(
      db().execute({
        sql: "INSERT INTO payment_intents (id, transaction_id, payer_id, provider, amount_minor, idempotency_key, created_at) VALUES ('x', 'nope', 'p1', 'mock', 100, 'k', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects delivery -> missing transaction", async () => {
    await expect(
      db().execute({
        sql: "INSERT INTO deliveries (id, transaction_id) VALUES ('x', 'nope')",
        args: [],
      }),
    ).rejects.toThrow();
  });

  it("rejects dispute -> missing transaction", async () => {
    await seedProfile("p1");
    await expect(
      db().execute({
        sql: "INSERT INTO disputes (id, transaction_id, opened_by, reason, created_at, updated_at) VALUES ('x', 'nope', 'p1', 'r', ?, ?)",
        args: [AT, AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects ledger entry -> missing account and missing journal", async () => {
    await expect(
      db().execute({
        sql: "INSERT INTO ledger_entries (id, ledger_transaction_id, account_id, debit_minor) VALUES ('x', 'nope', 'acct_custody_asset', 100)",
        args: [],
      }),
    ).rejects.toThrow();
    await expect(
      db().execute({
        sql: "INSERT INTO ledger_entries (id, ledger_transaction_id, account_id, debit_minor) VALUES ('x', 'nope2', 'nope-acct', 100)",
        args: [],
      }),
    ).rejects.toThrow();
  });

  it("rejects refund -> missing transaction", async () => {
    await seedProfile("p1");
    await expect(
      db().execute({
        sql: "INSERT INTO refunds (id, transaction_id, amount_minor, requested_by, provider, created_at) VALUES ('x', 'nope', 100, 'p1', 'mock', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects settlement -> missing transaction", async () => {
    await seedProfile("p1");
    await expect(
      db().execute({
        sql: "INSERT INTO settlements (id, transaction_id, payee_id, amount_minor, provider, created_at) VALUES ('x', 'nope', 'p1', 100, 'mock', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
  });

  it("accepts a valid profile -> transaction -> participant chain (control)", async () => {
    await seedProfile("p1");
    await seedTx("t1", "p1");
    await db().execute({
      sql: "INSERT INTO transaction_participants (id, transaction_id, profile_id, role) VALUES ('part1', 't1', 'p1', 'seller')",
      args: [],
    });
    const rs = await db().execute("SELECT count(*) AS c FROM transaction_participants");
    expect(Number((rs.rows[0] as Record<string, unknown>)["c"])).toBe(1);
  });
});
