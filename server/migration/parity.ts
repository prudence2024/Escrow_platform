/**
 * Parity comparison engine (Phase 5, §11–§15). Pure: read, compare, report.
 * No writes, no auto-repair, no preference. Money compares as exact
 * integers — never formatted strings, never float tolerance.
 */
import { normalizeStatus, type ParitySnapshot, type ParityTx } from "./snapshots.js";

export type ParityResultCode =
  | "MATCH"
  | "MISSING_IN_CONVEX"
  | "MISSING_IN_TURSO"
  | "FIELD_MISMATCH"
  | "MONEY_MISMATCH"
  | "UNMAPPED_STATUS"
  | "ORPHAN_RELATION";

export interface ParityFinding {
  code: Exclude<ParityResultCode, "MATCH">;
  entity: string;
  key: string;
  field?: string;
  convex: unknown;
  turso: unknown;
}

export interface ParityReport {
  convexCounts: { profiles: number; transactions: number };
  tursoCounts: { profiles: number; transactions: number };
  matchedTransactions: number;
  matchedProfiles: number;
  findings: ParityFinding[];
  /** Machine + human summary line. */
  summary: string;
}

const MONEY_FIELDS = [
  "amountMinor",
  "deliveryFeeMinor",
  "platformFeeMinor",
  "totalMinor",
  "refundTotalMinor",
] as const;

const SCALAR_FIELDS = ["currency", "origin", "itemCount", "itemQuantityTotal"] as const;

const STATE_FIELDS = [
  "deliveryStatus",
  "disputeStatus",
  "paymentStatus",
  "settlementStatus",
] as const;

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function compareParity(convex: ParitySnapshot, turso: ParitySnapshot): ParityReport {
  const findings: ParityFinding[] = [];

  const tursoProfiles = new Map(turso.profiles.map((p) => [p.email, p]));
  const convexProfiles = new Map(convex.profiles.map((p) => [p.email, p]));
  let matchedProfiles = 0;
  for (const [email, cProfile] of convexProfiles) {
    const tProfile = tursoProfiles.get(email);
    if (tProfile === undefined) {
      findings.push({ code: "MISSING_IN_TURSO", entity: "profile", key: email, convex: email, turso: null });
      continue;
    }
    if (!sameStringList(cProfile.roles, tProfile.roles)) {
      findings.push({ code: "FIELD_MISMATCH", entity: "profile", key: email, field: "roles", convex: cProfile.roles, turso: tProfile.roles });
      continue;
    }
    if ((cProfile.displayName ?? null) !== (tProfile.displayName ?? null)) {
      findings.push({ code: "FIELD_MISMATCH", entity: "profile", key: email, field: "displayName", convex: cProfile.displayName, turso: tProfile.displayName });
      continue;
    }
    matchedProfiles += 1;
  }
  for (const email of tursoProfiles.keys()) {
    if (!convexProfiles.has(email)) {
      findings.push({ code: "MISSING_IN_CONVEX", entity: "profile", key: email, convex: null, turso: email });
    }
  }

  const tursoTx = new Map(turso.transactions.map((t) => [t.publicReference, t]));
  const convexTx = new Map(convex.transactions.map((t) => [t.publicReference, t]));
  let matchedTransactions = 0;
  for (const [ref, cTx] of convexTx) {
    const tTx = tursoTx.get(ref);
    if (tTx === undefined) {
      findings.push({ code: "MISSING_IN_TURSO", entity: "transaction", key: ref, convex: ref, turso: null });
      continue;
    }
    if (compareOneTransaction(ref, cTx, tTx, findings)) matchedTransactions += 1;
  }
  for (const ref of tursoTx.keys()) {
    if (!convexTx.has(ref)) {
      findings.push({ code: "MISSING_IN_CONVEX", entity: "transaction", key: ref, convex: null, turso: ref });
    }
  }

  // Orphan relations: referenced emails with no profile on EITHER side.
  for (const [label, snapshot] of [["convex", convex], ["turso", turso]] as const) {
    const emails = new Set(snapshot.profiles.map((p) => p.email));
    for (const tx of snapshot.transactions) {
      for (const email of [tx.sellerEmail, tx.buyerEmail, ...tx.participantEmails]) {
        if (email !== null && email !== "" && !emails.has(email)) {
          findings.push({ code: "ORPHAN_RELATION", entity: "transaction", key: `${label}:${tx.publicReference}`, field: "participant", convex: label === "convex" ? email : null, turso: label === "turso" ? email : null });
        }
      }
    }
  }

  const summary = `profiles ${matchedProfiles}/${convex.profiles.length} matched, transactions ${matchedTransactions}/${convex.transactions.length} matched, ${findings.length} finding(s)`;
  return {
    convexCounts: { profiles: convex.profiles.length, transactions: convex.transactions.length },
    tursoCounts: { profiles: turso.profiles.length, transactions: turso.transactions.length },
    matchedTransactions,
    matchedProfiles,
    findings,
    summary,
  };
}

function compareOneTransaction(
  ref: string,
  cTx: ParityTx,
  tTx: ParityTx,
  findings: ParityFinding[],
): boolean {
  let ok = true;
  const cStatus = normalizeStatus(cTx.status);
  const tStatus = normalizeStatus(tTx.status);
  if (cStatus === null || tStatus === null) {
    findings.push({ code: "UNMAPPED_STATUS", entity: "transaction", key: ref, field: "status", convex: cTx.status, turso: tTx.status });
    return false;
  }
  if (cStatus !== tStatus) {
    findings.push({ code: "FIELD_MISMATCH", entity: "transaction", key: ref, field: "status", convex: cTx.status, turso: tTx.status });
    ok = false;
  }
  if ((cTx.sellerEmail ?? null) !== (tTx.sellerEmail ?? null)) {
    findings.push({ code: "FIELD_MISMATCH", entity: "transaction", key: ref, field: "seller", convex: cTx.sellerEmail, turso: tTx.sellerEmail });
    ok = false;
  }
  if ((cTx.buyerEmail ?? null) !== (tTx.buyerEmail ?? null)) {
    findings.push({ code: "FIELD_MISMATCH", entity: "transaction", key: ref, field: "buyer", convex: cTx.buyerEmail, turso: tTx.buyerEmail });
    ok = false;
  }
  if (!sameStringList(cTx.participantEmails, tTx.participantEmails)) {
    findings.push({ code: "FIELD_MISMATCH", entity: "transaction", key: ref, field: "participants", convex: cTx.participantEmails, turso: tTx.participantEmails });
    ok = false;
  }
  for (const field of MONEY_FIELDS) {
    if (cTx[field] !== tTx[field]) {
      findings.push({ code: "MONEY_MISMATCH", entity: "transaction", key: ref, field, convex: cTx[field], turso: tTx[field] });
      ok = false;
    }
  }
  for (const field of SCALAR_FIELDS) {
    if (cTx[field] !== tTx[field]) {
      findings.push({ code: "FIELD_MISMATCH", entity: "transaction", key: ref, field, convex: cTx[field], turso: tTx[field] });
      ok = false;
    }
  }
  for (const field of STATE_FIELDS) {
    if ((cTx[field] ?? null) !== (tTx[field] ?? null)) {
      findings.push({ code: "FIELD_MISMATCH", entity: "transaction", key: ref, field, convex: cTx[field], turso: tTx[field] });
      ok = false;
    }
  }
  return ok;
}
