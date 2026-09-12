/**
 * Rich parity rehearsal gate (Phase 6, §16–§23).
 * Synthetic Convex-shaped artifact → validate → import isolated Turso DB →
 * both snapshots → compare. Requires the FULL §23 gate: zero missing,
 * zero mismatches, zero orphans, zero unknown states, zero skipped
 * financial records. Any finding fails loudly (no redefinition).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import { runMigrations } from "../db/migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { buildRichConvexArtifact } from "./fixtures/richArtifact.js";
import { normalizeConvexSnapshot, buildTursoSnapshot } from "./snapshots.js";
import { compareParity } from "./parity.js";
import { importArtifact } from "./devImport.js";

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

describe("rich parity rehearsal", () => {
  it("covers all 16 canonical states with zero findings", async () => {
    const artifact = buildRichConvexArtifact();
    const imported = await importArtifact(db(), artifact, {
      dryRun: false,
      target: { mode: "memory", isProductionCloud: false },
      nowMs: AT,
    });
    expect(imported.warnings.join("; ")).not.toMatch(/transaction|payment|settlement|refund|dispute/i);

    const convex = normalizeConvexSnapshot(artifact);
    const turso = await buildTursoSnapshot(db());
    const report = compareParity(convex, turso);

    expect(report.convexCounts.transactions).toBe(16);
    expect(report.tursoCounts.transactions).toBe(16);
    expect(report.matchedTransactions).toBe(16);
    expect(report.findings).toEqual([]);
    expect(report.summary).toMatch(/16\/16 matched/);
  });

  it("derives the same effective payment state after FAILED→SECURED retry", async () => {
    const artifact = buildRichConvexArtifact();
    await importArtifact(db(), artifact, {
      dryRun: false,
      target: { mode: "memory", isProductionCloud: false },
      nowMs: AT,
    });
    // Both attempts preserved (history intact)...
    const attempts = await db().execute(
      "SELECT status FROM payment_intents WHERE transaction_id = 'jx-tx-secured' ORDER BY created_at ASC",
    );
    expect(attempts.rows.map((r) => String((r as Record<string, unknown>)["status"]))).toEqual([
      "FAILED",
      "SECURED",
    ]);
    // ...and both sides agree the effective state is SECURED.
    const turso = await buildTursoSnapshot(db());
    const tx = turso.transactions.find((t) => t.publicReference === "dex_rich_secured");
    expect(tx?.paymentStatus).toBe("SECURED");
    expect(tx?.totalMinor).toBe(1320000);
  });

  it("matches roles incl. unknown-legacy downgrade (role parity)", async () => {
    const artifact = buildRichConvexArtifact();
    await importArtifact(db(), artifact, {
      dryRun: false,
      target: { mode: "memory", isProductionCloud: false },
      nowMs: AT,
    });
    const turso = await buildTursoSnapshot(db());
    const byEmail = new Map(turso.profiles.map((p) => [p.email, p]));
    expect(byEmail.get("seller@dev.test")?.roles).toEqual(["seller"]);
    expect(byEmail.get("admin@dev.test")?.roles).toEqual(["super_admin"]);
    expect(byEmail.get("ops@dev.test")?.roles).toEqual(["operations"]);
    expect(byEmail.get("weird@dev.test")?.roles).toEqual([]);
    const convex = normalizeConvexSnapshot(artifact);
    const report = compareParity(convex, turso);
    expect(report.matchedProfiles).toBe(convex.profiles.length);
  });
});
