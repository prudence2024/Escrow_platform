/**
 * Export-artifact inspector tests (Phase 3, §48).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectExportArtifact } from "./convexExport.js";

describe("export inspector", () => {
  it("reports per-entity counts without writing anything", () => {
    const dir = mkdtempSync(join(tmpdir(), "dealsure-export-"));
    try {
      const path = join(dir, "artifact.json");
      writeFileSync(
        path,
        JSON.stringify({
          exportedAt: 1780000000000,
          source: "convex-dev",
          collections: {
            transactions: [{ _id: "a" }, { _id: "b" }],
            profiles: [{ _id: "p" }],
          },
        }),
      );
      const report = inspectExportArtifact(path);
      expect(report.totalRecords).toBe(3);
      expect(report.entities.find((e) => e.entity === "transactions")).toMatchObject({
        target: "transactions",
        count: 2,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects non-artifact files loudly", () => {
    const dir = mkdtempSync(join(tmpdir(), "dealsure-export-"));
    try {
      const path = join(dir, "bad.json");
      writeFileSync(path, JSON.stringify({ hello: "world" }));
      expect(() => inspectExportArtifact(path)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
