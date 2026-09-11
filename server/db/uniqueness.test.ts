/**
 * Uniqueness tests (Phase 3, §42).
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
    sql: "INSERT INTO profiles (id, email, onboarded, created_at, updated_at) VALUES ('seller', 's@e.com', 1, ?, ?), ('buyer', 'b@e.com', 1, ?, ?)",
    args: [AT, AT, AT, AT],
  });
  await db().execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, seller_id, title, description, category,
       amount_minor, total_minor, status, created_at, updated_at)
     VALUES ('tx1', 'ref-1', 'slug-1', 'seller', 't', 'd', 'Other', 5000, 5000, 'DRAFT', ?, ?)`,
    args: [AT, AT],
  });
}

describe("uniqueness", () => {
  it("rejects duplicate public reference", async () => {
    await seedBasics();
    await expect(
      db().execute({
        sql: `INSERT INTO transactions
          (id, public_reference, invite_slug, seller_id, title, description, category,
           amount_minor, total_minor, status, created_at, updated_at)
         VALUES ('tx2', 'ref-1', 'slug-2', 'seller', 't', 'd', 'Other', 5000, 5000, 'DRAFT', ?, ?)`,
        args: [AT, AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate invite slug", async () => {
    await seedBasics();
    await expect(
      db().execute({
        sql: `INSERT INTO transactions
          (id, public_reference, invite_slug, seller_id, title, description, category,
           amount_minor, total_minor, status, created_at, updated_at)
         VALUES ('tx2', 'ref-2', 'slug-1', 'seller', 't', 'd', 'Other', 5000, 5000, 'DRAFT', ?, ?)`,
        args: [AT, AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate provider webhook event", async () => {
    await db().execute({
      sql: "INSERT INTO provider_webhook_events (id, provider, provider_event_id, event_type, received_at) VALUES ('w1', 'mock', 'evt-1', 'x', ?)",
      args: [AT],
    });
    await expect(
      db().execute({
        sql: "INSERT INTO provider_webhook_events (id, provider, provider_event_id, event_type, received_at) VALUES ('w2', 'mock', 'evt-1', 'x', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate idempotency key within scope", async () => {
    await db().execute({
      sql: "INSERT INTO idempotency_keys (id, scope, idempotency_key, created_at) VALUES ('k1', 'refund.create', 'abc', ?)",
      args: [AT],
    });
    await expect(
      db().execute({
        sql: "INSERT INTO idempotency_keys (id, scope, idempotency_key, created_at) VALUES ('k2', 'refund.create', 'abc', ?)",
        args: [AT],
      }),
    ).rejects.toThrow();
  });

  it("prevents a second PAID settlement per transaction (allows PENDING rows)", async () => {    await seedBasics();
    const insertSettlement = (id: string, status: string) =>
      db().execute({
        sql: "INSERT INTO settlements (id, transaction_id, payee_id, amount_minor, status, provider, created_at) VALUES (?, 'tx1', 'seller', 5000, ?, 'mock', ?)",
        args: [id, status, AT],
      });
    await insertSettlement("s-pending-1", "PENDING");
    await insertSettlement("s-pending-2", "PENDING");
    await insertSettlement("s-paid-1", "PAID");
    await expect(insertSettlement("s-paid-2", "PAID")).rejects.toThrow();
  });

  it("allows only one OPEN dispute per transaction (resolved disputes free the slot)", async () => {
    await seedBasics();
    const openDispute = (id: string) =>
      db().execute({
        sql: "INSERT INTO disputes (id, transaction_id, opened_by, reason, created_at, updated_at) VALUES (?, 'tx1', 'buyer', 'r', ?, ?)",
        args: [id, AT, AT],
      });
    await openDispute("d-open-1");
    await expect(openDispute("d-open-2")).rejects.toThrow();
    await db().execute({
      sql: "UPDATE disputes SET status = 'RESOLVED', resolved_by = 'buyer', resolved_at = ? WHERE id = 'd-open-1'",
      args: [AT],
    });
    await openDispute("d-open-3");
  });
});
