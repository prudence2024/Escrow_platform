/**
 * Write mode resolution tests (Phase 7, §3).
 * Validates: default disabled, unknown values fail, production + draft-development fails.
 */
import { describe, expect, it } from "vitest";
import { resolveApiWriteMode } from "../auth/writeModes.js";

describe("resolveApiWriteMode", () => {
  it("defaults to disabled", () => {
    expect(resolveApiWriteMode({}, "development")).toBe("disabled");
  });

  it("accepts draft-development in non-production", () => {
    expect(resolveApiWriteMode({ API_WRITE_MODE: "draft-development" }, "development")).toBe("draft-development");
    expect(resolveApiWriteMode({ API_WRITE_MODE: "draft-development" }, "test")).toBe("draft-development");
  });

  it("accepts disabled explicitly", () => {
    expect(resolveApiWriteMode({ API_WRITE_MODE: "disabled" }, "production")).toBe("disabled");
  });

  it("rejects unknown values", () => {
    expect(() => resolveApiWriteMode({ API_WRITE_MODE: "hacker" }, "development")).toThrow("Invalid API_WRITE_MODE");
  });

  it("rejects draft-development in production", () => {
    expect(() => resolveApiWriteMode({ API_WRITE_MODE: "draft-development" }, "production")).toThrow(
      "not permitted in production",
    );
  });

  it("case insensitive", () => {
    expect(resolveApiWriteMode({ API_WRITE_MODE: "DISABLED" }, "development")).toBe("disabled");
    expect(resolveApiWriteMode({ API_WRITE_MODE: "Draft-Development" }, "development")).toBe("draft-development");
  });
});
