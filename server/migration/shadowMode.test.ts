/**
 * Shadow-read mode tests (Phase 5, §20–§21).
 * Mode resolution is pure: off by default, compare only when explicitly
 * enabled, production always forces off.
 */
import { describe, expect, it } from "vitest";
import { resolveShadowMode } from "./shadow-cli.js";

describe("shadow-read mode", () => {
  it("defaults to off", () => {
    expect(resolveShadowMode({})).toBe("off");
    expect(resolveShadowMode({ SHADOW_READ_MODE: "" })).toBe("off");
    expect(resolveShadowMode({ SHADOW_READ_MODE: "serve-turso" })).toBe("off");
  });

  it("enables compare only when explicitly set", () => {
    expect(resolveShadowMode({ SHADOW_READ_MODE: "compare" })).toBe("compare");
  });

  it("production forces off even when requested", () => {
    expect(resolveShadowMode({ NODE_ENV: "production", SHADOW_READ_MODE: "compare" })).toBe("off");
  });
});
