/**
 * Structural guard (Phase 4, §18): the production server entry must never
 * import test-only authentication. If this test fails, someone wired
 * TestPrincipalAuth into real serving code — revert immediately.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const serverDir = dirname(fileURLToPath(import.meta.url));

describe("no test auth in production entry", () => {
  it("server.ts does not reference TestPrincipalAuth", () => {
    const entry = readFileSync(join(serverDir, "server.ts"), "utf8");
    expect(entry).not.toMatch(/TestPrincipalAuth/);
    expect(entry).not.toMatch(/x-test-principal/);
  });
});
