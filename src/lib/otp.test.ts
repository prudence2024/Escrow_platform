/**
 * Delivery OTP primitive tests (Phase 2, §15).
 */
import { describe, expect, it } from "vitest";
import {
  digestOtp,
  digestsEqual,
  generateSecureNumericCode,
  normalizeOtpInput,
} from "./otp";

const SECRET = "test-server-secret-only";
const CTX_A = "tx_1:del_1";
const CTX_B = "tx_1:del_2";

describe("secure generation", () => {
  it("produces exact-length digit strings", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateSecureNumericCode(6);
      expect(code).toMatch(/^[0-9]{6}$/);
    }
  });

  it("produces unique codes (CSPRNG sanity over a batch)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateSecureNumericCode(6));
    // A broken constant/weak generator would collapse; 200 six-digit codes
    // must not all collide (practically they are all distinct).
    expect(seen.size).toBeGreaterThan(190);
  });

  it("rejects invalid lengths", () => {
    expect(() => generateSecureNumericCode(3)).toThrow();
    expect(() => generateSecureNumericCode(13)).toThrow();
  });
});

describe("keyed digest storage", () => {
  const code = "482910";

  it("is deterministic for the same inputs", () => {
    expect(digestOtp({ secret: SECRET, context: CTX_A, otp: code })).toBe(
      digestOtp({ secret: SECRET, context: CTX_A, otp: code }),
    );
  });

  it("never contains the plaintext OTP", () => {
    const digest = digestOtp({ secret: SECRET, context: CTX_A, otp: code });
    expect(digest).not.toContain(code);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("binds to the secret (wrong secret fails)", () => {
    const stored = digestOtp({ secret: SECRET, context: CTX_A, otp: code });
    const candidate = digestOtp({ secret: "other-secret", context: CTX_A, otp: code });
    expect(digestsEqual(stored, candidate)).toBe(false);
  });

  it("binds to per-record context (no cross-row replay)", () => {
    const stored = digestOtp({ secret: SECRET, context: CTX_A, otp: code });
    const replay = digestOtp({ secret: SECRET, context: CTX_B, otp: code });
    expect(digestsEqual(stored, replay)).toBe(false);
  });

  it("wrong OTP fails", () => {
    const stored = digestOtp({ secret: SECRET, context: CTX_A, otp: code });
    expect(digestsEqual(stored, digestOtp({ secret: SECRET, context: CTX_A, otp: "000000" }))).toBe(
      false,
    );
  });

  it("rejects malformed digests safely", () => {
    expect(digestsEqual("not-hex", "also-not-hex")).toBe(false);
    expect(digestsEqual("ab", "abcd")).toBe(false);
  });

  it("requires secret, context, and value", () => {
    expect(() => digestOtp({ secret: "", context: CTX_A, otp: code })).toThrow();
    expect(() => digestOtp({ secret: SECRET, context: "", otp: code })).toThrow();
    expect(() => digestOtp({ secret: SECRET, context: CTX_A, otp: "" })).toThrow();
  });

  it("normalizes user input before digesting", () => {
    expect(normalizeOtpInput("  482910\n")).toBe("482910");
  });
});
