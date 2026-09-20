/**
 * Authenticated API tests via the Convex JWT verifier (Phase 6, §13).
 * Full route path with locally-minted RS256 tokens (same verification code
 * as production wiring): 401 matrix, forged-identity ignorance, trusted
 * role loading, and stranger denial.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Client } from "@libsql/client";
import type { Hono } from "hono";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { runMigrations } from "../db/migrate.js";
import { openTestDb, REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { createApp } from "./app.js";
import type { ApiEnv } from "./middleware.js";
import { ConvexJwtVerifier } from "../auth/convexJwtVerifier.js";
import type { ApiAuth } from "../auth/apiAuth.js";
import { createConsoleLogger } from "../observability/logger.js";
import { TursoTransactionRepository } from "../repositories/TursoTransactionRepository.js";
import { TursoUserRepository } from "../repositories/TursoUserRepository.js";
import { TransactionQueryService } from "../services/TransactionQueryService.js";
import { UserQueryService } from "../services/UserQueryService.js";

const AT = 1780000000000;
const ISSUER = "https://convex-test.example.com";

let client: Client | null = null;

function db(): Client {
  if (!client) throw new Error("no test db");
  return client;
}

async function seedBasics(): Promise<void> {
  await db().execute({
    sql: "INSERT INTO profiles (id, email, display_name, onboarded, created_at, updated_at) VALUES ('seller', 's@e.com', 'Seller', 1, ?, ?), ('buyer', 'b@e.com', 'Buyer', 1, ?, ?), ('stranger', 'x@e.com', 'Stranger', 1, ?, ?)",
    args: [AT, AT, AT, AT, AT, AT],
  });
  await db().execute({
    sql: `INSERT INTO transactions
      (id, public_reference, invite_slug, seller_id, buyer_id, title, description, category,
       amount_minor, delivery_fee_minor, platform_fee_minor, total_minor, status, created_at, updated_at)
     VALUES ('tx1', 'ref-1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'seller', 'buyer', 'Camera', 'Nice camera',
       'Electronics', 2000000, 100000, 0, 2100000, 'PAYMENT_SECURED', ?, ?)`,
    args: [AT, AT],
  });
  await db().execute({
    sql: "INSERT INTO transaction_participants (id, transaction_id, profile_id, role, accepted_at) VALUES ('part1', 'tx1', 'buyer', 'buyer', ?)",
    args: [AT],
  });
}

interface MintContext {
  jwks: unknown;
  mint: (sub: string, overrides?: { issuer?: string; audience?: string; expired?: boolean; kid?: string; key?: unknown }) => Promise<string>;
}

async function makeMint(): Promise<MintContext> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = (await exportJWK(publicKey)) as unknown as Record<string, unknown>;
  publicJwk["kid"] = "k1";
  publicJwk["alg"] = "RS256";
  return {
    jwks: { keys: [publicJwk] },
    mint: async (sub, overrides = {}) => {
      const builder = new SignJWT({ sub })
        .setProtectedHeader({ alg: "RS256", kid: overrides.kid ?? "k1" })
        .setIssuedAt()
        .setIssuer(overrides.issuer ?? ISSUER)
        .setAudience(overrides.audience ?? "convex");
      if (overrides.expired === true) {
        builder.setExpirationTime(Math.floor(Date.now() / 1000) - 60);
      } else {
        builder.setExpirationTime("1h");
      }
      return builder.sign(overrides.key as never ?? privateKey);
    },
  };
}

function convexApp(jwks: unknown, issuer: string = ISSUER): Hono<ApiEnv> {
  const verifier = new ConvexJwtVerifier({ issuer, audience: "convex", jwks });
  const auth: ApiAuth = {
    resolvePrincipal: async (req: Request) => {
      const header = req.headers.get("authorization");
      const match = /^Bearer (.+)$/.exec((header ?? "").trim());
      return verifier.toPrincipal(match === null ? null : match[1]);
    },
  };
  const txRepo = new TursoTransactionRepository(db());
  const userRepo = new TursoUserRepository(db());
  return createApp({
    auth,
    txService: new TransactionQueryService(txRepo, userRepo),
    draftService: null,
    userService: new UserQueryService(userRepo),
    checkReadiness: async () => ({ ready: true, migrations: { applied: 13, expected: 13 } }),
    corsAllowedOrigins: [],
    logger: createConsoleLogger(),
    writeEnabled: false,
  });
}

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  client = await openTestDb();
  await runMigrations(client, REPO_MIGRATIONS_DIR);
  await seedBasics();
});

afterEach(() => {
  client?.close();
  client = null;
});

describe("convex bearer auth at the API layer", () => {
  it("401 matrix: missing/malformed/expired/wrong-issuer/wrong-audience/bad-signature", async () => {
    const { jwks, mint } = await makeMint();
    const app = convexApp(jwks);
    const cases: Array<[string, Record<string, string> | undefined]> = [
      ["missing", undefined],
      ["malformed", bearer("not-a-jwt")],
      ["expired", bearer(await mint("seller|s1", { expired: true }))],
      ["wrong-issuer", bearer(await mint("seller|s1", { issuer: "https://evil.example.com" }))],
      ["wrong-audience", bearer(await mint("seller|s1", { audience: "someone-else" }))],
    ];
    for (const [name, headers] of cases) {
      const res = await app.request("/api/v1/transactions", headers === undefined ? undefined : { headers });
      expect(res.status, name).toBe(401);
    }
    // Bad signature: token minted by an unknown key.
    const attacker = await makeMint();
    const forged = await attacker.mint("seller|s1");
    const badSig = await convexApp(jwks).request("/api/v1/transactions", { headers: bearer(forged) });
    expect(badSig.status).toBe(401);
  });

  it("valid token authenticates seller and buyer reads", async () => {
    const { jwks, mint } = await makeMint();
    const app = convexApp(jwks);
    const sellerRes = await app.request("/api/v1/transactions/ref-1", {
      headers: bearer(await mint("seller|s1")),
    });
    expect(sellerRes.status).toBe(200);
    const buyerRes = await app.request("/api/v1/transactions/ref-1", {
      headers: bearer(await mint("buyer|s2")),
    });
    expect(buyerRes.status).toBe(200);
  });

  it("forged body/query identity is ignored (verified sub rules)", async () => {
    const { jwks, mint } = await makeMint();
    const app = convexApp(jwks);
    const res = await app.request("/api/v1/transactions/ref-1?userId=stranger&role=super_admin", {
      headers: bearer(await mint("seller|s1")),
      method: "GET",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { viewerRole: string; title: string };
    expect(body.viewerRole).toBe("seller");
    expect(body.title).toBe("Camera");
  });

  it("unrelated verified user is existence-hidden", async () => {
    const { jwks, mint } = await makeMint();
    const app = convexApp(jwks);
    const res = await app.request("/api/v1/transactions/ref-1", {
      headers: bearer(await mint("stranger|s9")),
    });
    expect(res.status).toBe(404);
  });
});
