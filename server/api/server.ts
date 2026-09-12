#!/usr/bin/env tsx
/**
 * DealSure API server entry (Phase 4).
 *
 * - Validates config (production fails closed via resolveDbConfig).
 * - Opens the database (modes: cloud/file/memory per TURSO_DATABASE_URL).
 * - Ensures migrations: empty non-prod DBs migrate automatically WITH a log
 *   line (dev ergonomics); production NEVER auto-migrates — a missing or
 *   partial schema there is fatal (run `npm run migrate` explicitly).
 * - Serves the Hono app via @hono/node-server with graceful shutdown.
 *
 * Auth wiring: DenyAllAuth by default (API_AUTH_MODE=deny, the default
 * everywhere). API_AUTH_MODE=convex selects the verified Convex JWT adapter
 * with explicit server-side issuer/audience configuration; discovery or JWKS
 * failures are startup-fatal. Protected data routes therefore answer 401
 * unless convex mode is deliberately configured AND verified at startup.
 */
import { serve } from "@hono/node-server";
import type { Client } from "@libsql/client";
import { resolveDbConfig } from "../config/env.js";
import { resolveServerConfig } from "../config/serverEnv.js";
import { openDatabase } from "../db/client.js";
import { appliedMigrations, loadMigrations, runMigrations } from "../db/migrate.js";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DenyAllAuth } from "../auth/apiAuth.js";
import type { ApiAuth } from "../auth/apiAuth.js";
import { resolveApiAuthMode } from "../auth/authModes.js";
import { createConvexAuth } from "../auth/convexAuthMode.js";
import { tursoRoleLoader } from "../auth/roleLoader.js";
import { createConsoleLogger } from "../observability/logger.js";
import { createApp } from "./app.js";
import { TursoTransactionRepository } from "../repositories/TursoTransactionRepository.js";
import { TursoUserRepository } from "../repositories/TursoUserRepository.js";
import { TransactionQueryService } from "../services/TransactionQueryService.js";
import { UserQueryService } from "../services/UserQueryService.js";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "db", "migrations");

async function ensureMigrated(client: Client, isProduction: boolean, log: (m: string) => void): Promise<number> {
  const files = loadMigrations(MIGRATIONS_DIR);
  if (isProduction) {
    // Production NEVER auto-migrates: verify only, zero writes.
    let applied = 0;
    try {
      applied = (await appliedMigrations(client)).size;
    } catch {
      throw new Error(
        "Production database is not migrated. Run `npm run migrate` explicitly; startup refuses to mutate production schema.",
      );
    }
    if (applied < files.length) {
      throw new Error(
        `Production database is behind (${applied}/${files.length} migrations). Run \`npm run migrate\` explicitly.`,
      );
    }
    return files.length;
  }
  const result = await runMigrations(client, MIGRATIONS_DIR);
  if (result.applied.length > 0) {
    log(`Applied ${result.applied.length} migration(s) to non-production database`);
  }
  return files.length;
}

async function main(): Promise<void> {
  const logger = createConsoleLogger();
  const serverConfig = resolveServerConfig(process.env);
  const dbConfig = resolveDbConfig(process.env);
  const client = await openDatabase(dbConfig);
  const expectedMigrations = await ensureMigrated(
    client,
    serverConfig.isProduction,
    (message) => logger.log("warn", message, {}),
  );

  const txRepo = new TursoTransactionRepository(client);
  const userRepo = new TursoUserRepository(client);
  // Auth mode: deny by default (dev included). convex mode requires explicit
  // CONVEX_ISSUER_URL (+ optional CONVEX_AUDIENCE); discovery/JWKS failures
  // are startup-fatal, never degraded. Production stays deny unless a later
  // phase explicitly authorizes convex wiring after live verification.
  const authMode = resolveApiAuthMode(process.env);
  let auth: ApiAuth = new DenyAllAuth();
  if (authMode === "convex") {
    logger.log("info", "convex auth mode selected", {});
    auth = await createConvexAuth(process.env, tursoRoleLoader(client));
    logger.log("info", "convex auth verifier ready", {});
  }
  const app = createApp({
    auth,
    txService: new TransactionQueryService(txRepo, userRepo),
    userService: new UserQueryService(userRepo),
    checkReadiness: async () => {
      try {
        await client.execute("SELECT 1");
        const applied = await appliedMigrations(client);
        const ready = applied.size >= expectedMigrations;
        return { ready, migrations: { applied: applied.size, expected: expectedMigrations } };
      } catch {
        return { ready: false, migrations: { applied: 0, expected: expectedMigrations } };
      }
    },
    corsAllowedOrigins: serverConfig.corsAllowedOrigins,
    logger,
  });

  const server = serve({ fetch: app.fetch, port: serverConfig.port }, (info) => {
    logger.log("info", "listening", { port: info.port });
  });

  const shutdown = (signal: string): void => {
    logger.log("info", "shutdown", { signal });
    server.close(() => {
      void client.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(`api server failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
