/**
 * Development import tests (Phase 5, §17–§18).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import { runMigrations } from "../db/migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { importArtifact, ImportRefusedError } from "./devImport.js";
import type { ConvexExportArtifact } from "./snapshots.js";

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

function artifact(): ConvexExportArtifact {
  return {
    exportedAt: AT,
    source: "convex-dev-test",
    collections: {
      users: [
        { _id: "jx-seller", email: "seller@dev.test", name: "Seller", role: "seller" },
        { _id: "jx-buyer", email: "buyer@dev.test", name: "Buyer", role: "user" },
      ],
      transactions: [
        {
          _id: "jx-tx-1", publicId: "dex_test_1", slug: "s".repeat(32),
          sellerId: "jx-seller", buyerId: "jx-buyer", title: "Seed camera",
          description: "d", category: "Electronics", amountKobo: 2500000,
          deliveryFeeKobo: 100000, totalKobo: 2600000, currency: "NGN", status: "PAYMENT_SECURED",
        },
      ],
      transaction_participants: [
        { _id: "jx-part-1", transactionId: "jx-tx-1", userId: "jx-buyer", role: "buyer" },
      ],
      payment_intents: [
        { _id: "jx-pi-1", transactionId: "jx-tx-1", payerId: "jx-buyer", provider: "mock", amountKobo: 2600000, status: "SECURED", idempotencyKey: "k1" },
      ],
      delivery_otps: [{ _id: "jx-otp-1", code: "123456" }],
    },
  };
}

const LOCAL_TARGET = { mode: "memory" as const, isProductionCloud: false };

describe("dev import", () => {
  it("dry-run plans counts without writing", async () => {
    const counts = await importArtifact(db(), artifact(), { dryRun: true, target: LOCAL_TARGET, nowMs: AT });
    expect((counts.inserted["transactions (planned)"] ?? 0)).toBe(1);
    expect((counts.inserted["profiles (planned)"] ?? 0)).toBe(2);
    const rs = await db().execute("SELECT count(*) AS c FROM transactions");
    expect(Number((rs.rows[0] as Record<string, unknown>)["c"])).toBe(0);
  });

  it("imports then reruns idempotently (no duplicates, history untouched)", async () => {
    const first = await importArtifact(db(), artifact(), { dryRun: false, target: LOCAL_TARGET, nowMs: AT });
    expect(first.inserted["transactions"] ?? 0).toBe(1);
    const second = await importArtifact(db(), artifact(), { dryRun: false, target: LOCAL_TARGET, nowMs: AT });
    expect(second.inserted["transactions"] ?? 0).toBe(0);
    expect((second.skippedExisting["transactions"] ?? 0)).toBe(1);
    const rs = await db().execute("SELECT count(*) AS c FROM transactions");
    expect(Number((rs.rows[0] as Record<string, unknown>)["c"])).toBe(1);
  });

  it("skips OTP rows by policy (plaintext never transfers)", async () => {
    const counts = await importArtifact(db(), artifact(), { dryRun: false, target: LOCAL_TARGET, nowMs: AT });
    expect((counts.skippedByPolicy["delivery_otps"] ?? 0)).toBe(1);
    expect(counts.warnings.length).toBeGreaterThan(0);
    const rs = await db().execute("SELECT count(*) AS c FROM delivery_otps");
    expect(Number((rs.rows[0] as Record<string, unknown>)["c"])).toBe(0);
  });

  it("rejects unknown collections loudly", async () => {
    const bad = artifact();
    (bad.collections as Record<string, unknown[]>)["starships"] = [{ _id: "x" }];
    await expect(
      importArtifact(db(), bad, { dryRun: true, target: LOCAL_TARGET, nowMs: AT }),
    ).rejects.toThrow(ImportRefusedError);
  });

  it("rejects missing required fields loudly", async () => {
    const bad = artifact();
    (bad.collections["transactions"] as Array<Record<string, unknown>>)[0] = { _id: "jx-tx-9" };
    await expect(
      importArtifact(db(), bad, { dryRun: true, target: LOCAL_TARGET, nowMs: AT }),
    ).rejects.toThrow(ImportRefusedError);
  });

  it("refuses production-cloud targets unconditionally", async () => {
    await expect(
      importArtifact(db(), artifact(), {
        dryRun: true,
        target: { mode: "turso", isProductionCloud: true },
        nowMs: AT,
      }),
    ).rejects.toThrow(ImportRefusedError);
  });
});
