#!/usr/bin/env tsx
/**
 * Repeatable parity rehearsal (Phase 6, §29). DEVELOPMENT ONLY.
 *
 * Usage: npm run parity:rehearse [-- --db file:./parity.db]
 *
 * Pipeline (explicit fixtures only, never production):
 *   rich synthetic artifact → validate → dry-run → import isolated DB →
 *   Convex snapshot → Turso snapshot → compare → machine report + summary.
 * Refuses production environments unconditionally.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unlinkSync, existsSync } from "node:fs";
import { assertDevSeedAllowed, resolveDbConfig } from "../config/env.js";
import { openDatabase } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { REPO_MIGRATIONS_DIR } from "../db/testUtils.js";
import { buildRichConvexArtifact } from "./fixtures/richArtifact.js";
import { normalizeConvexSnapshot, buildTursoSnapshot } from "./snapshots.js";
import { compareParity } from "./parity.js";
import { importArtifact } from "./devImport.js";

async function main(): Promise<void> {
  assertDevSeedAllowed(process.env);
  const dbFlag = process.argv.indexOf("--db");
  const dbUrl = dbFlag >= 0 && process.argv[dbFlag + 1] !== undefined
    ? process.argv[dbFlag + 1]
    : "file:./parity-rehearsal.db";
  if (dbUrl !== undefined && dbUrl.startsWith("file:") && existsSync(dbUrl.slice("file:".length))) {
    unlinkSync(dbUrl.slice("file:".length));
  }
  const env: Record<string, string | undefined> = { ...process.env, TURSO_DATABASE_URL: dbUrl };
  const config = resolveDbConfig(env);
  if (config.isProductionCloud) {
    throw new Error("Parity rehearsal refuses production-cloud targets");
  }
  const client = await openDatabase(config);
  try {
    await runMigrations(client, REPO_MIGRATIONS_DIR);
    const artifact = buildRichConvexArtifact();
    const imported = await importArtifact(client, artifact, { dryRun: false, target: { mode: config.mode, isProductionCloud: false }, nowMs: Date.now() });
    const convex = normalizeConvexSnapshot(artifact);
    const turso = await buildTursoSnapshot(client);
    const report = compareParity(convex, turso);
    console.log(JSON.stringify({ target: dbUrl, imported, report }, null, 2));
    if (report.findings.length > 0) process.exitCode = 1;
  } finally {
    client.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(`parity:rehearse failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
