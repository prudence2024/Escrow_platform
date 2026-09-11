/**
 * DealSure portable identity primitives (Phase 3, §9, §15).
 *
 * - Internal IDs: UUID v4 TEXT (crypto.randomUUID — portable, non-sequential).
 * - Public references: `dex_<base36 time><randhex>` (human-usable, unique).
 * - Invite slugs: 32 lowercase hex chars = 128-bit CSPRNG capability tokens,
 *   never derived from the internal ID.
 *
 * Framework-free and unit-tested.
 */

export function newId(randomUUID: () => string = defaultRandomUUID): string {
  return randomUUID();
}

function defaultRandomUUID(): string {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    throw new Error("No secure UUID source available");
  }
  return globalThis.crypto.randomUUID();
}

export function newPublicReference(
  prefix = "dex",
  nowMs: number = Date.now(),
  randHex: string = randomHex(8),
): string {
  return `${prefix}_${nowMs.toString(36)}${randHex}`;
}

/** 128-bit unguessable invite slug (32 hex chars). Capability token: never
 * derived from IDs, timestamps, references, or user data — CSPRNG only. */
export function newInviteSlug(randHex: string = randomHex(16)): string {
  if (!/^[0-9a-f]{32}$/.test(randHex)) {
    throw new Error("Invite slug entropy must be 32 lowercase hex chars (128 bits)");
  }
  return randHex;
}

export function randomHex(bytes: number): string {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.getRandomValues !== "function"
  ) {
    throw new Error("No secure random source available");
  }
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  let out = "";
  for (const b of arr) out += b.toString(16).padStart(2, "0");
  return out;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
