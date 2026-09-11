/**
 * DealSure delivery/auth OTP primitives (Phase 2, Decision G).
 *
 * - Generation: cryptographically secure randomness only (never Math.random).
 * - Storage: HMAC-SHA256 digest keyed with a server-only secret and
 *   per-record context. Plaintext OTP is NEVER stored or logged here.
 * - Comparison: timing-safe equality.
 *
 * Framework-free: runs in Convex functions, Node tests, and future server
 * code. Uses @oslojs/crypto (pure JS) so behavior is identical everywhere.
 */

import { hmac } from "@oslojs/crypto/hmac";
import { SHA256 } from "@oslojs/crypto/sha2";

const HEX = "0123456789abcdef";

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex digest");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export interface RandomSource {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

const defaultRandom: RandomSource =
  typeof globalThis.crypto !== "undefined" &&
  typeof globalThis.crypto.getRandomValues === "function"
    ? {
        getRandomValues: <T extends Uint8Array>(array: T): T =>
          globalThis.crypto.getRandomValues(array),
      }
    : (() => {
        throw new Error("No secure random source available");
      })();

/** CSPRNG numeric code of exactly `length` digits (may include leading 0s). */
export function generateSecureNumericCode(
  length: number,
  random: RandomSource = defaultRandom,
): string {
  if (!Number.isInteger(length) || length < 4 || length > 12) {
    throw new Error("OTP length must be an integer between 4 and 12");
  }
  const digits = "0123456789";
  // Rejection-sample each digit to avoid modulo bias.
  let code = "";
  const buf = new Uint8Array(16);
  while (code.length < length) {
    random.getRandomValues(buf);
    for (const b of buf) {
      if (code.length >= length) break;
      if (b < 250) code += digits[b % 10]; // 250 is the largest multiple of 10 < 256
    }
  }
  return code;
}

export interface OtpDigestInput {
  /** Server-only secret (DELIVERY_OTP_HASH_SECRET or auth-OTP sibling). */
  secret: string;
  /** Per-record context binding the digest to one OTP row. */
  context: string;
  otp: string;
}

function encoder(): (s: string) => Uint8Array {
  return (s: string) => new TextEncoder().encode(s);
}

/**
 * HMAC-SHA256(secret, context + ":" + otp) as lowercase hex.
 * Context MUST uniquely identify the OTP record (e.g.
 * `${transactionId}:${deliveryId}`) so digests cannot be replayed across rows.
 */
export function digestOtp(input: OtpDigestInput): string {
  if (!input.secret) throw new Error("OTP secret is required");
  if (!input.context) throw new Error("OTP context is required");
  if (!input.otp) throw new Error("OTP value is required");
  const encode = encoder();
  const mac = hmac(
    SHA256,
    encode(input.secret),
    encode(`${input.context}:${input.otp}`),
  );
  return bytesToHex(mac);
}

/** Timing-safe comparison of two hex digests. False on any mismatch. */
export function digestsEqual(aHex: string, bHex: string): boolean {
  let a: Uint8Array;
  let b: Uint8Array;
  try {
    a = hexToBytes(aHex);
    b = hexToBytes(bHex);
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Normalize user-entered codes (trim whitespace; digits otherwise intact). */
export function normalizeOtpInput(raw: string): string {
  return raw.trim();
}
