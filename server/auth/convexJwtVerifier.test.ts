/**
 * Convex JWT verifier tests (Phase 5, §22).
 * Tokens minted with a local RS256 keypair (jose generateKeyPair) through
 * the SAME verification path as production (JWKS + issuer + audience +
 * expiry). Runtime verification is never weakened: the verifier under test
 * always verifies; only the key source differs per environment.
 */
import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { ConvexJwtVerifier } from "./convexJwtVerifier.js";

const ISSUER = "https://convex-test.example.com";
const AUDIENCE = "convex";

interface TestKeys {
  publicJwk: Record<string, unknown>;
  sign: (claims: Record<string, unknown>, kid?: string) => Promise<string>;
}

async function makeKeys(kid = "test-key-1"): Promise<TestKeys> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = (await exportJWK(publicKey)) as unknown as Record<string, unknown>;
  publicJwk["kid"] = kid;
  publicJwk["alg"] = "RS256";
  publicJwk["use"] = "sig";
  return {
    publicJwk,
    sign: async (claims: Record<string, unknown>, useKid: string | undefined = kid) =>
      await new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", ...(useKid === undefined ? {} : { kid: useKid }) })
        .setIssuedAt()
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setExpirationTime("1h")
        .sign(privateKey),
  };
}

function verifierFor(
  jwks: unknown,
  loadRoles: (userId: string) => Promise<string[]> = async () => [],
): ConvexJwtVerifier {
  return new ConvexJwtVerifier({ issuer: ISSUER, audience: AUDIENCE, jwks }, loadRoles);
}

function jwksOf(publicJwk: Record<string, unknown>): unknown {
  return { keys: [publicJwk] };
}

describe("Convex JWT verification", () => {
  it("missing credential resolves to null (401 at the route)", async () => {
    const { publicJwk } = await makeKeys();
    const verifier = verifierFor(jwksOf(publicJwk));
    expect(await verifier.verifyIdentity(null)).toBeNull();
    expect(await verifier.verifyIdentity("")).toBeNull();
    expect(await verifier.verifyIdentity("   ")).toBeNull();
  });

  it("malformed credential resolves to null", async () => {
    const { publicJwk } = await makeKeys();
    const verifier = verifierFor(jwksOf(publicJwk));
    expect(await verifier.verifyIdentity("not-a-jwt")).toBeNull();
    expect(await verifier.verifyIdentity("a.b.c")).toBeNull();
  });

  it("expired credential resolves to null", async () => {
    const { publicKey, privateKey } = await (async () => {
      const pair = await generateKeyPair("RS256");
      return pair;
    })();
    const jwk = (await exportJWK(publicKey)) as unknown as Record<string, unknown>;
    jwk["kid"] = "k1";
    jwk["alg"] = "RS256";
    const verifier = verifierFor(jwksOf(jwk));
    const expired = await new SignJWT({ sub: "u1|s1" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);
    expect(await verifier.verifyIdentity(expired)).toBeNull();
  });

  it("wrong key / unknown kid resolves to null (signature enforced)", async () => {
    const { publicJwk } = await makeKeys("real-key");
    const attacker = await makeKeys("attacker-key");
    const verifier = verifierFor(jwksOf(publicJwk));
    const forged = await attacker.sign({ sub: "victim|s1" });
    expect(await verifier.verifyIdentity(forged)).toBeNull();
  });

  it("valid credential yields verified identity (never trusts claims blindly)", async () => {
    const { publicJwk, sign } = await makeKeys();
    const verifier = verifierFor(jwksOf(publicJwk));
    const token = await sign({ sub: "user-42|session-7" });
    expect(await verifier.verifyIdentity(token)).toEqual({
      userId: "user-42",
      sessionId: "session-7",
      expiresAtSeconds: expect.any(Number),
    });
  });

  it("malformed sub claim resolves to null", async () => {
    const { publicJwk, sign } = await makeKeys();
    const verifier = verifierFor(jwksOf(publicJwk));
    expect(await verifier.verifyIdentity(await sign({ sub: "no-divider" }))).toBeNull();
    expect(await verifier.verifyIdentity(await sign({ sub: "|empty-user" }))).toBeNull();
    expect(await verifier.verifyIdentity(await sign({}))).toBeNull();
  });

  it("forged body userId/role are ignored; roles come from the trusted loader", async () => {
    const { publicJwk, sign } = await makeKeys();
    const seen: string[] = [];
    const verifier = verifierFor(jwksOf(publicJwk), async (userId: string) => {
      seen.push(userId);
      return userId === "user-42" ? ["seller"] : [];
    });
    const token = await sign({ sub: "user-42|session-7", role: "super_admin", userId: "attacker" });
    const principal = await verifier.toPrincipal(token);
    expect(principal?.userId).toBe("user-42");
    expect(principal?.roles).toEqual(["seller"]);
    expect(seen).toEqual(["user-42"]);
  });

  it("untrusted role strings from the loader are filtered out", async () => {
    const { publicJwk, sign } = await makeKeys();
    const verifier = verifierFor(jwksOf(publicJwk), async () => ["super_admin", "root", "finance"]);
    const principal = await verifier.toPrincipal(await sign({ sub: "u|s" }));
    expect(principal?.roles).toEqual(["super_admin", "finance"]);
  });

  it("wrong issuer is rejected", async () => {
    const { publicJwk, sign } = await makeKeys();
    const strict = new ConvexJwtVerifier(
      { issuer: "https://other-issuer.example.com", audience: AUDIENCE, jwks: jwksOf(publicJwk) },
      async () => [],
    );
    expect(await strict.verifyIdentity(await sign({ sub: "u|s" }))).toBeNull();
  });
});
