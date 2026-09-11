/**
 * Money/integer tests (Phase 3, §17, §43).
 * - CHECK constraints reject negative amounts and bad quantities.
 * - Domain guards reject non-integers and unsafe integers.
 * - Schema inspection proves authoritative money columns are INTEGER.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import { runMigrations } from "./migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "./testUtils.js";
import {
  assertMinorAmount,
  assertPositiveMinorAmount,
  assertTransactionMinorAmount,
  MAX_TRANSACTION_MINOR,
  MoneyError,
} from "../domain/money.js";

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

describe("money constraints", () => {
  it("rejects negative authoritative amounts", async () => {
    await db().execute({
      sql: "INSERT INTO profiles (id, onboarded, created_at, updated_at) VALUES ('p', 1, ?, ?)",
      args: [AT, AT],
    });
    await expect(
      db().execute({
        sql: `INSERT INTO transactions
          (id, public_reference, invite_slug, seller_id, title, description, category,
           amount_minor, total_minor, status, created_at, updated_at)
         VALUES ('txneg', 'ref-neg', 'slug-neg', 'p', 't', 'd', 'Other', -5, -5, 'DRAFT', ?, ?)`,
        args: [AT, AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects non-positive quantities and zero payment/refund amounts", async () => {
    await db().execute({
      sql: "INSERT INTO profiles (id, onboarded, created_at, updated_at) VALUES ('p', 1, ?, ?)",
      args: [AT, AT],
    });
    await db().execute({
      sql: `INSERT INTO transactions
        (id, public_reference, invite_slug, seller_id, title, description, category,
         amount_minor, total_minor, status, created_at, updated_at)
       VALUES ('txq', 'ref-q', 'slug-q', 'p', 't', 'd', 'Other', 5000, 5000, 'DRAFT', ?, ?)`,
      args: [AT, AT],
    });
    await expect(
      db().execute({
        sql: "INSERT INTO transaction_items (id, transaction_id, name, quantity, unit_amount_minor) VALUES ('i0', 'txq', 'n', 0, 100)",
        args: [],
      }),
    ).rejects.toThrow();
    await expect(
      db().execute({
        sql: "INSERT INTO payment_intents (id, transaction_id, payer_id, provider, amount_minor, idempotency_key, created_at) VALUES ('pi0', 'txq', 'p', 'mock', 0, 'k0', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
    await expect(
      db().execute({
        sql: "INSERT INTO refunds (id, transaction_id, amount_minor, requested_by, provider, created_at) VALUES ('r0', 'txq', -1, 'p', 'mock', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
  });

  it("preserves integer minor units exactly (no float drift)", async () => {
    await db().execute({
      sql: "INSERT INTO profiles (id, onboarded, created_at, updated_at) VALUES ('p', 1, ?, ?)",
      args: [AT, AT],
    });
    await db().execute({
      sql: `INSERT INTO transactions
        (id, public_reference, invite_slug, seller_id, title, description, category,
         amount_minor, total_minor, status, created_at, updated_at)
       VALUES ('txm', 'ref-m', 'slug-m', 'p', 't', 'd', 'Other', 2500000, 2500000, 'DRAFT', ?, ?)`,
      args: [AT, AT],
    });
    const rs = await db().execute("SELECT amount_minor AS a FROM transactions WHERE id = 'txm'");
    expect(rs.rows[0]).toBeDefined();
    expect(Number((rs.rows[0] as Record<string, unknown>)["a"])).toBe(2500000);
  });

  it("domain guards reject unsafe JavaScript integers", () => {
    expect(() => assertMinorAmount(Number.MAX_SAFE_INTEGER + 1, "amount")).toThrow(MoneyError);
    expect(() => assertMinorAmount(12.5, "amount")).toThrow(MoneyError);
    expect(() => assertMinorAmount("100", "amount")).toThrow(MoneyError);
    expect(() => assertMinorAmount(-1, "amount")).toThrow(MoneyError);
    expect(() => assertPositiveMinorAmount(0, "amount")).toThrow(MoneyError);
    expect(() => assertTransactionMinorAmount(MAX_TRANSACTION_MINOR + 1, "amount")).toThrow(MoneyError);
    expect(() => assertTransactionMinorAmount(2500000, "amount")).not.toThrow();
  });

  it("authoritative money columns are INTEGER, never REAL", async () => {
    const moneyColumns: Array<[string, string]> = [
      ["transactions", "amount_minor"],
      ["transactions", "delivery_fee_minor"],
      ["transactions", "platform_fee_minor"],
      ["transactions", "total_minor"],
      ["transaction_items", "unit_amount_minor"],
      ["payment_intents", "amount_minor"],
      ["ledger_entries", "debit_minor"],
      ["ledger_entries", "credit_minor"],
      ["settlements", "amount_minor"],
      ["refunds", "amount_minor"],
    ];
    for (const [table, column] of moneyColumns) {
      const rs = await db().execute(`PRAGMA table_info(${table})`);
      const col = (rs.rows as Array<Record<string, unknown>>).find((r) => r["name"] === column);
      expect(col, `${table}.${column} exists`).toBeDefined();
      expect(String(col?.["type"]).toUpperCase()).toBe("INTEGER");
    }
    // No REAL columns anywhere in financial tables.
    for (const table of ["transactions", "payment_intents", "ledger_entries", "settlements", "refunds"]) {
      const rs = await db().execute(`PRAGMA table_info(${table})`);
      for (const row of rs.rows as Array<Record<string, unknown>>) {
        expect(
          String(row["type"]).toUpperCase().includes("REAL"),
          `${table}.${String(row["name"])} must not be REAL`,
        ).toBe(false);
      }
    }
  });
});
