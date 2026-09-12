/**
 * Parity engine tests (Phase 5, §16). Pure-function coverage; the engine
 * performs no I/O by construction (proven by input-immutability check).
 */
import { describe, expect, it } from "vitest";
import { compareParity } from "./parity.js";
import type { ParitySnapshot, ParityTx } from "./snapshots.js";

function tx(overrides: Partial<ParityTx> = {}): ParityTx {
  return {
    publicReference: "dex_1",
    status: "DRAFT",
    sellerEmail: "seller@dev.test",
    buyerEmail: null,
    participantEmails: [],
    amountMinor: 2500000,
    deliveryFeeMinor: 100000,
    platformFeeMinor: 0,
    totalMinor: 2600000,
    currency: "NGN",
    origin: "SHARE_LINK",
    itemCount: 1,
    itemQuantityTotal: 1,
    deliveryStatus: null,
    disputeStatus: null,
    paymentStatus: null,
    settlementStatus: null,
    refundTotalMinor: 0,
    ...overrides,
  };
}

function snapshot(
  transactions: ParityTx[],
  emails: string[] = ["seller@dev.test"],
): ParitySnapshot {
  return {
    exportedAt: 1,
    source: "test",
    profiles: emails.map((email) => ({ email, displayName: null, roles: ["seller"] })),
    transactions,
  };
}

describe("parity engine", () => {
  it("identical snapshots pass with zero findings", () => {
    const report = compareParity(snapshot([tx()]), snapshot([tx()]));
    expect(report.matchedTransactions).toBe(1);
    expect(report.findings).toEqual([]);
  });

  it("missing Turso transaction fails", () => {
    const report = compareParity(snapshot([tx()]), snapshot([]));
    expect(report.findings).toEqual([
      { code: "MISSING_IN_TURSO", entity: "transaction", key: "dex_1", convex: "dex_1", turso: null },
    ]);
  });

  it("extra Turso transaction fails", () => {
    const report = compareParity(snapshot([]), snapshot([tx()]));
    expect(report.findings.some((f) => f.code === "MISSING_IN_CONVEX" && f.key === "dex_1")).toBe(true);
  });

  it("status mismatch fails", () => {
    const report = compareParity(
      snapshot([tx({ status: "PAYMENT_SECURED" })]),
      snapshot([tx({ status: "DISPATCHED" })]),
    );
    expect(report.findings.some((f) => f.code === "FIELD_MISMATCH" && f.field === "status")).toBe(true);
    expect(report.matchedTransactions).toBe(0);
  });

  it("money mismatch fails exactly (no tolerance)", () => {
    const report = compareParity(
      snapshot([tx({ totalMinor: 2600000 })]),
      snapshot([tx({ totalMinor: 2600001 })]),
    );
    const money = report.findings.filter((f) => f.code === "MONEY_MISMATCH");
    expect(money).toHaveLength(1);
    expect(money[0]).toMatchObject({ field: "totalMinor", convex: 2600000, turso: 2600001 });
  });

  it("participant mismatch fails", () => {
    const report = compareParity(
      snapshot([tx({ participantEmails: ["buyer@dev.test"] })], ["seller@dev.test", "buyer@dev.test"]),
      snapshot([tx({ participantEmails: [] })]),
    );
    expect(report.findings.some((f) => f.code === "FIELD_MISMATCH" && f.field === "participants")).toBe(true);
  });

  it("unknown status fails loudly (never silently equivalent)", () => {
    const report = compareParity(
      snapshot([tx({ status: "TELEPORTED" })]),
      snapshot([tx({ status: "DRAFT" })]),
    );
    expect(report.findings.some((f) => f.code === "UNMAPPED_STATUS")).toBe(true);
  });

  it("comparison writes to neither source (inputs deeply unchanged)", () => {
    const convex = snapshot([tx()], ["seller@dev.test"]);
    const turso = snapshot([tx()], ["seller@dev.test"]);
    const before = JSON.stringify({ convex, turso });
    compareParity(convex, turso);
    expect(JSON.stringify({ convex, turso })).toBe(before);
  });

  it("orphan relations are reported", () => {
    const report = compareParity(
      snapshot([tx({ sellerEmail: "ghost@dev.test" })]),
      snapshot([tx({ sellerEmail: "ghost@dev.test" })]),
    );
    expect(report.findings.some((f) => f.code === "ORPHAN_RELATION")).toBe(true);
  });

  it("multi-role sets compare as sets (order-free match, divergence fails)", () => {
    const multi = (roles: string[]): ParitySnapshot => ({
      exportedAt: 1,
      source: "test",
      profiles: [{ email: "ops@dev.test", displayName: null, roles }],
      transactions: [],
    });
    expect(
      compareParity(multi(["operations", "support"]), multi(["support", "operations"])).findings,
    ).toEqual([]);
    const divergent = compareParity(multi(["operations", "support"]), multi(["operations"]));
    expect(
      divergent.findings.some((f) => f.code === "FIELD_MISMATCH" && f.field === "roles"),
    ).toBe(true);
  });
});
