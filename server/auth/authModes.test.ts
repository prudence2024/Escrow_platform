/**
 * Auth mode + Convex wiring failure tests (Phase 6).
 * Unknown modes fail closed; convex mode requires explicit configuration;
 * discovery/JWKS failures are startup-fatal (never degraded auth).
 */
import { describe, expect, it } from "vitest";
import { resolveApiAuthMode, AuthModeError } from "./authModes.js";
import { createConvexAuth, ConvexAuthConfigError } from "./convexAuthMode.js";

describe("API auth modes", () => {
  it("defaults to deny (dev included)", () => {
    expect(resolveApiAuthMode({})).toBe("deny");
    expect(resolveApiAuthMode({ API_AUTH_MODE: "" })).toBe("deny");
    expect(resolveApiAuthMode({ API_AUTH_MODE: "deny" })).toBe("deny");
    expect(resolveApiAuthMode({ API_AUTH_MODE: "convex" })).toBe("convex");
  });

  it("unknown modes fail closed (never silently deny, never auto-enable)", () => {
    for (const mode of ["test", "debug", "header", "mock", "allow", "auto"]) {
      expect(() => resolveApiAuthMode({ API_AUTH_MODE: mode })).toThrow(AuthModeError);
    }
    // Case-insensitive normalization is deliberate (explicit values only).
    expect(resolveApiAuthMode({ API_AUTH_MODE: "CONVEX" })).toBe("convex");
    expect(resolveApiAuthMode({ API_AUTH_MODE: " Deny " })).toBe("deny");
  });
});

describe("convex mode wiring", () => {
  it("requires explicit issuer configuration", async () => {
    await expect(createConvexAuth({}, async () => [])).rejects.toThrow(ConvexAuthConfigError);
    await expect(
      createConvexAuth({ API_AUTH_MODE: "convex" }, async () => []),
    ).rejects.toThrow(ConvexAuthConfigError);
  });

  it("rejects non-https issuers", async () => {
    await expect(
      createConvexAuth({ CONVEX_ISSUER_URL: "http://insecure.example.com" }, async () => []),
    ).rejects.toThrow(ConvexAuthConfigError);
  });

  it("discovery failure is startup-fatal (no degraded auth)", async () => {
    const failingFetch = async (): Promise<Response> => {
      throw new Error("network down");
    };
    await expect(
      createConvexAuth({ CONVEX_ISSUER_URL: "https://convex.example.com" }, async () => [], failingFetch),
    ).rejects.toThrow(ConvexAuthConfigError);
  });

  it("missing jwks_uri is startup-fatal", async () => {
    const badDiscovery = async () =>
      new Response(JSON.stringify({ issuer: "x" }), { status: 200 });
    await expect(
      createConvexAuth({ CONVEX_ISSUER_URL: "https://convex.example.com" }, async () => [], badDiscovery),
    ).rejects.toThrow(ConvexAuthConfigError);
  });
});
