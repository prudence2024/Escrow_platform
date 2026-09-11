/**
 * DealSure Turso/libSQL client factory (Phase 3, §4–§6).
 *
 * SERVER-ONLY. This module must never be imported by browser/React code:
 * - `openDatabase` throws immediately if a window object exists.
 * - No credential defaults live here; config comes from resolveDbConfig.
 *
 * Every opened connection enforces `PRAGMA foreign_keys = ON`; the
 * migration/test suites verify enforcement rather than assuming it (§34).
 */

import { createClient, type Client } from "@libsql/client";
import type { DbConfig } from "../config/env";

export async function openDatabase(config: DbConfig): Promise<Client> {
  const scope = globalThis as unknown as Record<string, unknown>;
  if (typeof scope["window"] !== "undefined") {
    throw new Error(
      "openDatabase is server-only and must never run in the browser.",
    );
  }
  const client =
    config.authToken !== undefined
      ? createClient({ url: config.url, authToken: config.authToken })
      : createClient({ url: config.url });
  await client.execute("PRAGMA foreign_keys = ON");
  return client;
}

/** Read back the current foreign-key enforcement flag (tests/health). */
export async function foreignKeysEnforced(client: Client): Promise<boolean> {
  const rs = await client.execute("PRAGMA foreign_keys");
  const row = rs.rows[0] as unknown as Record<string, unknown> | undefined;
  return row !== undefined && Number(row["foreign_keys"]) === 1;
}
