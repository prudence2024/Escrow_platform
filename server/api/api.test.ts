/**
 * API integration tests (Phase 4, §29). Hono app exercised via
 * app.request() with in-process TestPrincipalAuth — no network, no cloud,
 * isolated memory DBs.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import type { Hono } from "hono";
import type { ApiEnv } from "./middleware.js";
import { runMigrations } from "../db/migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { createApp } from "./app.js";
import { DenyAllAuth } from "../auth/apiAuth.js";
import { TestPrincipalAuth, testPrincipal } from "../auth/testAuth.js";
import { createConsoleLogger } from "../observability/logger.js";
import { TursoTransactionRepository } from "../repositories/TursoTransactionRepository.js";
import { TursoUserRepository } from "../repositories/TursoUserRepository.js";
import { TransactionQueryService } from "../services/TransactionQueryService.js";
import { TransactionDraftService } from "../services/TransactionDraftService.js";
import { UserQueryService } from "../services/UserQueryService.js";

const AT = 1780000000000;
const SELLER = testPrincipal({ userId: "seller", legacyRole: null });
const BUYER = testPrincipal({ userId: "buyer", legacyRole: null });
const STRANGER = testPrincipal({ userId: "stranger", legacyRole: null });

let client: Client | null = null;

async function seedBasics(): Promise<void> {
  const db = client as Client;
  await db.execute({
    sql: "INSERT INTO profiles (id, email, display_name, onboarded, created_at, updated_at) VALUES ('seller', 's@e.com', 'Seller', 1, ?, ?), ('buyer', 'b@e.com', 'Buyer', 1, ?, ?), ('stranger', 'x@e.com', 'Stranger', 1, ?, ?)",
    args: [AT, AT, AT, AT, AT, AT],
  });
  await db.execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, seller_id, buyer_id, title, description, category,
       amount_minor, delivery_fee_minor, platform_fee_minor, total_minor, status, created_at, updated_at)
     VALUES ('tx1', 'ref-1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'seller', 'buyer', 'Camera', 'Nice camera',
       'Electronics', 2000000, 100000, 0, 2100000, 'PAYMENT_SECURED', ?, ?)`,
    args: [AT, AT],
  });
  await db.execute({
    sql: "INSERT INTO transaction_participants (id, transaction_id, profile_id, role, accepted_at) VALUES ('part1', 'tx1', 'buyer', 'buyer', ?)",
    args: [AT],
  });
  await db.execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, seller_id, title, description, category,
       amount_minor, delivery_fee_minor, platform_fee_minor, total_minor, status, created_at, updated_at)
     VALUES ('tx2', 'ref-2', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'seller', 'Lens', 'Nice lens',
       'Electronics', 1000000, 50000, 0, 1050000, 'PENDING_BUYER_ACCEPTANCE', ?, ?)`,
    args: [AT, AT],
  });
}

function testApp(auth: TestPrincipalAuth | DenyAllAuth): Hono<ApiEnv> {
  const db = client as Client;
  const txRepo = new TursoTransactionRepository(db);
  const userRepo = new TursoUserRepository(db);
  return createApp({
    auth,
    txService: new TransactionQueryService(txRepo, userRepo),
    draftService: null,
    userService: new UserQueryService(userRepo),
    checkReadiness: async () => {
      try {
        await db.execute("SELECT 1");
        return { ready: true, migrations: { applied: 13, expected: 13 } };
      } catch {
        return { ready: false, migrations: { applied: 0, expected: 13 } };
      }
    },
    corsAllowedOrigins: [],
    logger: createConsoleLogger(),
    writeEnabled: false,
  });
}

function authApp(): Hono<ApiEnv> {
  const auth = new TestPrincipalAuth();
  auth.add("seller", SELLER);
  auth.add("buyer", BUYER);
  auth.add("stranger", STRANGER);
  return testApp(auth);
}

beforeEach(async () => {
  client = await openTestDb();
  await runMigrations(client, REPO_MIGRATIONS_DIR);
  await seedBasics();
});

afterEach(() => {
  client?.close();
  client = null;
});

describe("infrastructure routes", () => {
  it("GET health returns ok with a request id", async () => {
    const res = await authApp().request("/api/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("GET readiness reports counts", async () => {
    const res = await authApp().request("/api/v1/readiness");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ready: true, migrations: { applied: 13, expected: 13 } });
  });

  it("unknown routes return the 404 envelope (no stack, has requestId)", async () => {
    const res = await authApp().request("/api/v1/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: Record<string, string> };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(typeof body.error.requestId).toBe("string");
    expect(JSON.stringify(body)).not.toMatch(/stack|at .*\(/);
  });

  it("invalid filters return the 400 envelope", async () => {
    const res = await authApp().request("/api/v1/transactions?role=hacker&x=1", {
      headers: { "x-test-principal": "seller" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: Record<string, string> };
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

describe("protected reads", () => {
  it("unauthenticated access is denied with 401 + envelope", async () => {
    const res = await authApp().request("/api/v1/transactions");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: Record<string, string> };
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(typeof body.error.requestId).toBe("string");
  });

  it("deny-by-default wiring 401s without test auth", async () => {
    const res = await testApp(new DenyAllAuth()).request("/api/v1/transactions", {
      headers: { "x-test-principal": "seller" },
    });
    expect(res.status).toBe(401);
  });

  it("seller and buyer reads allowed; stranger hidden-denied", async () => {
    const app = authApp();
    const seller = await app.request("/api/v1/transactions/ref-1", {
      headers: { "x-test-principal": "seller" },
    });
    expect(seller.status).toBe(200);
    const buyer = await app.request("/api/v1/transactions/ref-1", {
      headers: { "x-test-principal": "buyer" },
    });
    expect(buyer.status).toBe(200);
    const stranger = await app.request("/api/v1/transactions/ref-1", {
      headers: { "x-test-principal": "stranger" },
    });
    expect(stranger.status).toBe(404);
    const strangerBody = (await stranger.json()) as { error: Record<string, string> };
    expect(strangerBody.error.code).toBe("NOT_FOUND");
  });

  it("list is scoped to the caller and paginates", async () => {
    const app = authApp();
    const res = await app.request("/api/v1/transactions?limit=5", {
      headers: { "x-test-principal": "seller" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      pagination: { limit: number; total: number };
    };
    expect(body.pagination.total).toBe(2);
    expect(body.items).toHaveLength(2);
    const stranger = await app.request("/api/v1/transactions", {
      headers: { "x-test-principal": "stranger" },
    });
    const strangerBody = (await stranger.json()) as { pagination: { total: number } };
    expect(strangerBody.pagination.total).toBe(0);
  });

  it("huge page sizes clamp (no unbounded reads)", async () => {
    const res = await authApp().request("/api/v1/transactions?limit=1000000", {
      headers: { "x-test-principal": "seller" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pagination: { limit: number } };
    expect(body.pagination.limit).toBe(100);
  });
});

describe("safe invite route", () => {
  it("public preview returns only approved fields", async () => {
    const res = await authApp().request("/api/v1/invites/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        "amountMinor", "category", "currency", "deliveryFeeMinor", "description",
        "inspectionWindowDays", "returnTerms", "sellerDisplayName", "status",
        "title", "totalMinor",
      ].sort(),
    );
    expect(body["sellerDisplayName"]).toBe("Seller");
  });

  it("unknown or malformed slugs 404 without distinction", async () => {
    const app = authApp();
    expect((await app.request("/api/v1/invites/cccccccccccccccccccccccccccccccc")).status).toBe(404);
    expect((await app.request("/api/v1/invites/short")).status).toBe(404);
    expect((await app.request("/api/v1/invites/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).status).toBe(404);
  });
});

describe("failure mapping", () => {
  it("database failures map to safe envelopes without SQL leakage", async () => {
    const auth = new TestPrincipalAuth();
    auth.add("seller", SELLER);
    const app = testApp(auth);
    (client as Client).close();
    const readiness = await app.request("/api/v1/readiness");
    expect(readiness.status).toBe(503);
    const protectedRoute = await app.request("/api/v1/transactions", {
      headers: { "x-test-principal": "seller" },
    });
    expect(protectedRoute.status).toBe(503);
    const body = (await protectedRoute.json()) as { error: Record<string, string> };
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toMatch(/SELECT|FROM|sqlite/i);
    expect(typeof body.error.requestId).toBe("string");
  });
});
