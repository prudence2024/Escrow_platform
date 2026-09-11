/**
 * DEVELOPMENT-only Convex↔Turso shadow comparison (Phase 4, §26).
 *
 * Pure functions comparing two already-fetched snapshots (counts, public
 * references, statuses, minor-unit totals). This module performs NO I/O:
 * no second response, no preference, no write-back, no production queries.
 * Fetching the Convex side is an explicit future operation with its own
 * configuration — never automatic.
 */

export interface SnapshotRow {
  publicReference: string;
  status: string;
  totalMinor: number;
}

export interface ShadowMismatch {
  publicReference: string;
  field: "status" | "totalMinor" | "missingInTurso" | "missingInConvex";
  convex: string | number | null;
  turso: string | number | null;
}

export interface ShadowReport {
  convexCount: number;
  tursoCount: number;
  matched: number;
  mismatches: ShadowMismatch[];
}

export function compareSnapshots(convex: SnapshotRow[], turso: SnapshotRow[]): ShadowReport {
  const tursoByRef = new Map(turso.map((row) => [row.publicReference, row]));
  const convexByRef = new Map(convex.map((row) => [row.publicReference, row]));
  const mismatches: ShadowMismatch[] = [];
  let matched = 0;

  for (const cRow of convex) {
    const tRow = tursoByRef.get(cRow.publicReference);
    if (tRow === undefined) {
      mismatches.push({ publicReference: cRow.publicReference, field: "missingInTurso", convex: cRow.status, turso: null });
      continue;
    }
    let rowOk = true;
    if (cRow.status !== tRow.status) {
      mismatches.push({ publicReference: cRow.publicReference, field: "status", convex: cRow.status, turso: tRow.status });
      rowOk = false;
    }
    if (cRow.totalMinor !== tRow.totalMinor) {
      mismatches.push({ publicReference: cRow.publicReference, field: "totalMinor", convex: cRow.totalMinor, turso: tRow.totalMinor });
      rowOk = false;
    }
    if (rowOk) matched += 1;
  }
  for (const tRow of turso) {
    if (!convexByRef.has(tRow.publicReference)) {
      mismatches.push({ publicReference: tRow.publicReference, field: "missingInConvex", convex: null, turso: tRow.status });
    }
  }
  return { convexCount: convex.length, tursoCount: turso.length, matched, mismatches };
}
