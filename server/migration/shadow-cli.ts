#!/usr/bin/env tsx
/**
 * DEVELOPMENT-ONLY shadow comparison (Phase 5, §20–§21).
 *
 * Usage: npm run shadow:compare -- --artifact <convex-export.json> [--db <url>]
 *
 * Reads Turso, reads the EXPLICIT local artifact as the Convex side,
 * compares, prints the report. Never writes to either source, never serves
 * Turso responses, never runs in production (refused), never leaks
 * differences to users (stdout diagnostic only).
 *
 * SHADOW_READ_MODE: off (default) | compare. Production forces off.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { resolveDbConfig } from "../config/env.js";
import { openDatabase } from "../db/client.js";
import { buildTursoSnapshot, normalizeConvexSnapshot, type ConvexExportArtifact } from "./snapshots.js";
import { compareParity } from "./parity.js";

export type ShadowMode = "off" | "compare";

export function resolveShadowMode(env: Record<string, string | undefined>): ShadowMode {
  if ((env["NODE_ENV"] ?? "").toLowerCase() === "production") return "off";
  return env["SHADOW_READ_MODE"] === "compare" ? "compare" : "off";
}

async function main(): Promise<void> {
  const mode = resolveShadowMode(process.env);
  if (mode !== "compare") {
    console.log(JSON.stringify({ mode: "off", message: "Shadow compare disabled (SHADOW_READ_MODE != compare or production)" }));
    return;
  }
  const artifactFlag = process.argv.indexOf("--artifact");
  const artifactPath = artifactFlag >= 0 ? process.argv[artifactFlag + 1] : undefined;
  if (artifactPath === undefined || artifactPath === "") {
    throw new Error("shadow:compare requires --artifact <convex-export.json>");
  }
  const dbFlag = process.argv.indexOf("--db");
  const dbOverride = dbFlag >= 0 ? process.argv[dbFlag + 1] : undefined;
  const env: Record<string, string | undefined> = { ...process.env };
  if (dbOverride !== undefined && dbOverride !== "") env["TURSO_DATABASE_URL"] = dbOverride;
  const config = resolveDbConfig(env);
  if (config.isProductionCloud) {
    throw new Error("Shadow compare refuses production-cloud targets");
  }
  const artifact = JSON.parse(readFileSync(resolve(artifactPath), "utf8")) as ConvexExportArtifact;
  const client = await openDatabase(config);
  try {
    const turso = await buildTursoSnapshot(client);
    const convex = normalizeConvexSnapshot(artifact);
    const report = compareParity(convex, turso);
    console.log(JSON.stringify({ mode: "compare", ...report }, null, 2));
  } finally {
    client.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(`shadow:compare failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
