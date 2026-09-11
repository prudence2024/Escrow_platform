/**
 * Query-service authorization tests (Phase 4, §19, §28).
 * Seller/buyer/participant/staff matrix enforced at the service layer with
 * trusted principals — reference possession alone authorizes nothing.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";
import { runMigrations } from "../db/migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { TursoTransactionRepository } from "../repositories/TursoTransactionRepository.js";
import { TursoUserRepository } from "../repositories/TursoUserRepository.js";
import { AuthorizationError, TransactionQueryService } from "./TransactionQueryService.js";
import { UserQueryService } from "./UserQueryService.js";

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

function principal(userId: string, roles: AuthenticatedPrincipal["roles"] = []): AuthenticatedPrincipal {
  return {
    userId,
    email: `${userId}@example.com`,
    emailVerified: true,
    isAnonymous: false,
    roles,
    legacyRole: null,
  };
}

async function seedBasics(): Promise<void> {
  await db().execute({
    sql: "INSERT INTO profiles (id, email, display_name, onboarded, created_at, updated_at) VALUES ('seller', 's@e.com', 'Seller', 1, ?, ?), ('buyer', 'b@e.com', 'Buyer', 1, ?, ?), ('stranger', 'x@e.com', 'Stranger', 1, ?, ?)",
    args: [AT, AT, AT, AT, AT, AT],
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

function services() {
  const txRepo = new TursoTransactionRepository(db());
  const userRepo = new TursoUserRepository(db());
  return {
    tx: new TransactionQueryService(txRepo, userRepo),
    users: new UserQueryService(userRepo),
  };
}

describe("transaction read authorization", () => {
  it("seller and buyer can read; stranger is hidden-denied", async () => {
    await seedBasics();
    const { tx } = services();
    expect((await tx.detail(principal("seller"), "ref-1")).title).toBe("Camera");
    expect((await tx.detail(principal("buyer"), "ref-1")).title).toBe("Camera");
    await expect(tx.detail(principal("stranger"), "ref-1")).rejects.toThrow(AuthorizationError);
  });

  it("staff with support scope can read; missing tx also hides", async () => {
    await seedBasics();
    const { tx } = services();
    expect((await tx.detail(principal("staff", ["support"]), "ref-1")).viewerRole).toBe("staff");
    await expect(tx.detail(principal("stranger"), "ref-missing")).rejects.toThrow(AuthorizationError);
  });

  it("public reference lookup still requires authentication", async () => {
    await seedBasics();
    const { tx } = services();
    await expect(tx.detail(null, "ref-1")).rejects.toThrow();
  });

  it("invite slug returns only approved fields (no internals, no buyer data)", async () => {
    await seedBasics();
    const { tx } = services();
    // PENDING states only: seed a pre-acceptance row for the positive case.
    await db().execute({
      sql: `INSERT INTO transactions
        (id, public_reference, invite_slug, seller_id, title, description, category,
         amount_minor, delivery_fee_minor, platform_fee_minor, total_minor, status, created_at, updated_at)
       VALUES ('tx2', 'ref-2', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'seller', 'Lens', 'Nice lens',
         'Electronics', 1000000, 50000, 0, 1050000, 'PENDING_BUYER_ACCEPTANCE', ?, ?)`,
      args: [AT, AT],
    });
    const preview = await tx.invitePreview("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(preview).not.toBeNull();
    expect(Object.keys(preview ?? {}).sort()).toEqual(
      [
        "amountMinor", "category", "currency", "deliveryFeeMinor", "description",
        "inspectionWindowDays", "returnTerms", "sellerDisplayName", "status",
        "title", "totalMinor",
      ].sort(),
    );
    // Settled/other states are not previewable; unknown slugs are empty.
    expect(await tx.invitePreview("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    expect(await tx.invitePreview("cccccccccccccccccccccccccccccccc")).toBeNull();
  });

  it("pagination limit is enforced (no unbounded pages)", async () => {
    await seedBasics();
    // 105 seller transactions; a huge requested page must still cap at 100.
    for (let i = 0; i < 104; i++) {
      await db().execute({
        sql: `INSERT INTO transactions
          (id, public_reference, invite_slug, seller_id, title, description, category,
           amount_minor, total_minor, status, created_at, updated_at)
         VALUES (?, ?, ?, 'seller', ?, 'd', 'Other', 5000, 5000, 'DRAFT', ?, ?)`,
        args: [`bulk-${i}`, `bulk-ref-${i}`, `bulk-slug-${String(i).padStart(2, "0")}`, `Bulk ${i}`, AT, AT],
      });
    }
    const { tx } = services();
    const page = await tx.listMine(principal("seller"), { role: "all" }, { limit: 1000000, offset: 0 });
    expect(page.items).toHaveLength(100);
    expect(page.pagination.total).toBe(105);
    expect(page.pagination.limit).toBe(100);
  });
});

describe("profile privacy", () => {
  it("public seller DTO carries no private fields", async () => {
    await seedBasics();
    const { users } = services();
    const card = await users.publicSeller(principal("buyer"), "seller");
    expect(card).toEqual({ profileId: "seller", displayName: "Seller" });
    expect("email" in (card as object)).toBe(false);
  });

  it("own profile includes email and roles, nothing else sensitive", async () => {
    await seedBasics();
    const { users } = services();
    const mine = await users.myProfile(principal("seller"));
    expect(mine).toMatchObject({ id: "seller", email: "s@e.com", roles: [] });
    expect("phone" in (mine as object)).toBe(false);
  });
});
