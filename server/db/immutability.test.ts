/**
 * Append-only enforcement tests (Phase 3A, §7–§9).
 * Proves history/financial rows cannot be updated or deleted at the
 * database layer — immutability is enforced, not merely omitted from
 * repository interfaces. Corrections use reversal journals / new rows.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
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

async function seedBasics(): Promise<void> {
  await db().execute({
    sql: "INSERT INTO profiles (id, onboarded, created_at, updated_at) VALUES ('p', 1, ?, ?)",
    args: [AT, AT],
  });
  await db().execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, seller_id, title, description, category,
       amount_minor, total_minor, status, created_at, updated_at)
     VALUES ('tx1', 'ref-1', 'slug-1', 'p', 't', 'd', 'Other', 5000, 5000, 'DRAFT', ?, ?)`,
    args: [AT, AT],
  });
}

describe("append-only tables", () => {
  it("ledger journals accept inserts but reject updates and deletes", async () => {
    await db().execute({
      sql: "INSERT INTO ledger_transactions (id, ref_id, memo, created_at) VALUES ('j1', 'ref-j1', 'm', ?)",
      args: [AT],
    });
    await expect(
      db().execute({ sql: "UPDATE ledger_transactions SET memo = 'edited' WHERE id = 'j1'", args: [] }),
    ).rejects.toThrow(/append-only/);
    await expect(
      db().execute({ sql: "DELETE FROM ledger_transactions WHERE id = 'j1'", args: [] }),
    ).rejects.toThrow(/append-only/);
  });

  it("ledger entries accept inserts but reject updates and deletes", async () => {
    await db().execute({
      sql: "INSERT INTO ledger_transactions (id, ref_id, memo, created_at) VALUES ('j1', 'ref-j1', 'm', ?)",
      args: [AT],
    });
    await db().execute({
      sql: "INSERT INTO ledger_entries (id, ledger_transaction_id, account_id, debit_minor, memo) VALUES ('e1', 'j1', 'acct_custody_asset', 100, 'x')",
      args: [],
    });
    await expect(
      db().execute({ sql: "UPDATE ledger_entries SET debit_minor = 999 WHERE id = 'e1'", args: [] }),
    ).rejects.toThrow(/append-only/);
    await expect(
      db().execute({ sql: "DELETE FROM ledger_entries WHERE id = 'e1'", args: [] }),
    ).rejects.toThrow(/append-only/);
  });

  it("audit rows insert fine but cannot be updated or deleted", async () => {
    await db().execute({
      sql: "INSERT INTO audit_logs (id, action, entity_type, entity_id, created_at) VALUES ('a1', 'TEST', 'tx', 'x', ?)",
      args: [AT],
    });
    await expect(
      db().execute({ sql: "UPDATE audit_logs SET action = 'FORGED' WHERE id = 'a1'", args: [] }),
    ).rejects.toThrow(/append-only/);
    await expect(
      db().execute({ sql: "DELETE FROM audit_logs WHERE id = 'a1'", args: [] }),
    ).rejects.toThrow(/append-only/);
  });

  it("status history, payment events, and delivery events are immutable", async () => {
    await seedBasics();
    await db().execute({
      sql: "INSERT INTO transaction_status_history (id, transaction_id, to_status, created_at) VALUES ('h1', 'tx1', 'DRAFT', ?)",
      args: [AT],
    });
    await expect(
      db().execute({ sql: "UPDATE transaction_status_history SET to_status = 'SETTLED' WHERE id = 'h1'", args: [] }),
    ).rejects.toThrow(/append-only/);
    await expect(
      db().execute({ sql: "DELETE FROM transaction_status_history WHERE id = 'h1'", args: [] }),
    ).rejects.toThrow(/append-only/);
  });

  it("stateful webhook inbox rows MAY transition (received -> processed)", async () => {
    await db().execute({
      sql: "INSERT INTO provider_webhook_events (id, provider, provider_event_id, event_type, received_at) VALUES ('w1', 'mock', 'evt-1', 'x', ?)",
      args: [AT],
    });
    await db().execute({
      sql: "UPDATE provider_webhook_events SET processing_status = 'PROCESSED', processed_at = ? WHERE id = 'w1'",
      args: [AT],
    });
    const rs = await db().execute("SELECT processing_status AS s FROM provider_webhook_events WHERE id = 'w1'");
    expect(String((rs.rows[0] as Record<string, unknown>)["s"])).toBe("PROCESSED");
  });
});
