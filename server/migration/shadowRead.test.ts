/**
 * Shadow-read comparison tests (Phase 4, §26). Pure function coverage.
 */
import { describe, expect, it } from "vitest";
import { compareSnapshots } from "./shadowRead.js";

describe("compareSnapshots", () => {
  it("reports full match", () => {
    const rows = [{ publicReference: "a", status: "DRAFT", totalMinor: 100 }];
    const report = compareSnapshots(rows, [...rows]);
    expect(report).toMatchObject({ convexCount: 1, tursoCount: 1, matched: 1 });
    expect(report.mismatches).toEqual([]);
  });

  it("flags status, total, and missing-row differences", () => {
    const report = compareSnapshots(
      [
        { publicReference: "a", status: "DRAFT", totalMinor: 100 },
        { publicReference: "b", status: "SETTLED", totalMinor: 200 },
        { publicReference: "c", status: "DRAFT", totalMinor: 300 },
      ],
      [
        { publicReference: "a", status: "SETTLED", totalMinor: 100 },
        { publicReference: "b", status: "SETTLED", totalMinor: 250 },
        { publicReference: "d", status: "DRAFT", totalMinor: 400 },
      ],
    );
    expect(report.matched).toBe(0);
    const fields = report.mismatches.map((m) => `${m.publicReference}:${m.field}`).sort();
    expect(fields).toEqual(["a:status", "b:totalMinor", "c:missingInTurso", "d:missingInConvex"]);
  });
});
