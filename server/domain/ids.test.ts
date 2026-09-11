/**
 * Domain identity-primitive tests (Phase 3, §9, §15).
 */
import { describe, expect, it } from "vitest";
import { isUuid, newInviteSlug, newPublicReference } from "./ids.js";

describe("ids", () => {
  it("creates unique public references with the dex prefix", () => {
    const a = newPublicReference("dex", 1780000000000);
    const b = newPublicReference("dex", 1780000000000);
    expect(a.startsWith("dex_")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("creates 128-bit invite slugs independent of internal ids", () => {
    const internalId = "123e4567-e89b-42d3-a456-426614174000";
    const slug = newInviteSlug();
    expect(slug).toMatch(/^[0-9a-f]{32}$/);
    expect(slug).not.toContain(internalId.replace(/-/g, ""));
    expect(isUuid(internalId)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("rejects weak slug entropy", () => {
    expect(() => newInviteSlug("abc")).toThrow();
  });
});
