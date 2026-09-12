/**
 * Cloud smoke-target guard tests (Phase 6, §31–§32).
 * The guard refuses production AND ambiguous environments without touching
 * any database. Execution tests run against local libSQL only.
 */
import { describe, expect, it } from "vitest";
import { resolveSmokeTarget } from "./smoke.js";

describe("smoke target guard", () => {
  it("refuses production", () => {
    expect(() =>
      resolveSmokeTarget({ TURSO_ENVIRONMENT: "production", TURSO_DATABASE_URL: "libsql://x" }),
    ).toThrow();
  });

  it("refuses ambiguous/unknown environments", () => {
    for (const value of ["", "staging", "prod", "development-ish", "dev"]) {
      expect(() =>
        resolveSmokeTarget({ TURSO_ENVIRONMENT: value, TURSO_DATABASE_URL: "libsql://x" }),
      ).toThrow();
    }
    // Case/whitespace-tolerant exact match is accepted (normalization, not inference).
    expect(
      resolveSmokeTarget({ TURSO_ENVIRONMENT: "Development ", TURSO_DATABASE_URL: "libsql://x" }),
    ).toMatchObject({ url: "libsql://x" });
  });

  it("refuses missing URL even in development", () => {
    expect(() => resolveSmokeTarget({ TURSO_ENVIRONMENT: "development" })).toThrow();
  });

  it("accepts explicit development classification with URL", () => {
    expect(
      resolveSmokeTarget({ TURSO_ENVIRONMENT: "development", TURSO_DATABASE_URL: "libsql://dev.example.com" }),
    ).toMatchObject({ url: "libsql://dev.example.com" });
  });
});
