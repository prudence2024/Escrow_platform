/**
 * Turso read-repository tests (Phase 4, §28). Isolated memory DBs.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import { runMigrations } from "../db/migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { TursoTransactionRepository } from "./TursoTransactionRepository.js";
import { TursoUserRepository } from "./TursoUserRepository.js";

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
    sql: "INSERT INTO profiles (id, email, display_name, onboarded, created_at, updated_at) VALUES ('seller', 's@e.com', 'Seller', 1, ?, ?), ('buyer', 'b@e.com', 'Buyer', 1, ?, ?)",
    args: [AT, AT, AT, AT],
  });
  await db().execute({
    sql: "INSERT INTO user_roles (id, profile_id, role, granted_at) VALUES ('r1', 'seller', 'seller', ?)",
    args: [AT],
  });
  await db().execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, seller_id, buyer_id, title, description, category,
       amount_minor, delivery_fee_minor, platform_fee_minor, total_minor, status, created_at, updated_at)
     VALUES ('tx1', 'ref-1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'seller', 'buyer', 'Camera', 'Nice camera',
       'Electronics', 2000000, 100000, 0, 2100000, 'PAYMENT_SECURED', ?, ?)`,
    args: [AT, AT],
  });
  await db().execute({
    sql: "INSERT INTO transaction_participants (id, transaction_id, profile_id, role, accepted_at) VALUES ('part1', 'tx1', 'buyer', 'buyer', ?)",
    args: [AT],
  });
}

describe("TursoTransactionRepository reads", () => {
  it("finds an existing transaction by public reference", async () => {
    await seedBasics();
    const repo = new TursoTransactionRepository(db());
    const tx = await repo.findByPublicReference("ref-1");
    expect(tx?.title).toBe("Camera");
    expect(tx?.totalMinor).toBe(2100000);
  });

  it("returns null for a missing transaction (expected absence)", async () => {
    await seedBasics();
    const repo = new TursoTransactionRepository(db());
    expect(await repo.findByPublicReference("ref-nope")).toBeNull();
    expect(await repo.findById("nope")).toBeNull();
    expect(await repo.findByInviteSlug("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")).toBeNull();
  });

  it("lists a seller's transactions with totals", async () => {
    await seedBasics();
    const repo = new TursoTransactionRepository(db());
    const { items, total } = await repo.listForUser("seller", 20, 0, "seller");
    expect(total).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].publicReference).toBe("ref-1");
  });

  it("finds invite rows by slug", async () => {
    await seedBasics();
    const repo = new TursoTransactionRepository(db());
    expect((await repo.findByInviteSlug("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))?.id).toBe("tx1");
  });
});

describe("TursoUserRepository reads", () => {
  it("reads profiles and active roles", async () => {
    await seedBasics();
    const repo = new TursoUserRepository(db());
    expect((await repo.findProfileById("seller"))?.displayName).toBe("Seller");
    expect(await repo.activeRoles("seller")).toEqual(["seller"]);
    expect(await repo.activeRoles("buyer")).toEqual([]);
    expect(await repo.findProfileById("ghost")).toBeNull();
  });
});
