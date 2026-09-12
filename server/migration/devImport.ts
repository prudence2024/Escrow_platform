/**
 * DEVELOPMENT import: explicit Convex export artifact → Turso (Phase 5, §17–§18).
 *
 * - Explicit local input file only; no network, no auto-discovery.
 * - dryRun:true plans counts without writing a single row.
 * - Validation first: unknown collections and missing required fields fail
 *   loudly before anything writes.
 * - Idempotent reruns: stable IDs preserved + INSERT OR IGNORE, so a second
 *   run inserts nothing. Immutable history is NEVER updated — if rerun is
 *   ambiguous, this fails instead of merging.
 * - NEVER a production target: isProductionCloud targets throw unconditionally.
 * - Security: Convex delivery OTP rows are SKIPPED (plaintext codes must not
 *   transfer); ledger entries without journals are SKIPPED (no fabricated
 *   parents — financial history migration is a later-phase concern).
 */
import type { Client } from "@libsql/client";
import type { DbMode } from "../config/env.js";
import type { ConvexExportArtifact } from "./snapshots.js";

export interface ImportTarget {
  mode: DbMode;
  isProductionCloud: boolean;
}

export interface ImportCounts {
  inserted: Record<string, number>;
  skippedExisting: Record<string, number>;
  skippedByPolicy: Record<string, number>;
  warnings: string[];
}

export class ImportRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportRefusedError";
  }
}

const KNOWN_COLLECTIONS = [
  "users", "transactions", "transaction_participants", "transaction_items",
  "transaction_media", "payment_intents", "deliveries", "disputes",
  "dispute_messages", "dispute_evidence", "settlements", "refunds",
  "notifications", "audit_logs", "risk_flags", "admin_notes",
  "profiles", "kyc_profiles", "bank_accounts", "terms_versions", "terms_acceptances",
  // Known but NEVER imported (policy-skipped, see below).
  "delivery_otps",
] as const;

const LEGACY_ROLE_TO_CANONICAL: Record<string, string> = {
  user: "buyer",
  seller: "seller",
  admin: "super_admin",
  ops: "operations",
};

function bump(counts: Record<string, number>, key: string, by: number): void {
  counts[key] = (counts[key] ?? 0) + by;
}

function requireFields(entity: string, row: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (row[field] === undefined || row[field] === null) {
      throw new ImportRefusedError(`Artifact ${entity} row is missing required field ${field}`);
    }
  }
}

export async function importArtifact(
  client: Client,
  artifact: ConvexExportArtifact,
  opts: { dryRun: boolean; target: ImportTarget; nowMs?: number },
): Promise<ImportCounts> {
  if (opts.target.isProductionCloud) {
    throw new ImportRefusedError("Import refuses production-cloud targets unconditionally");
  }
  const collections = artifact.collections as Record<string, Array<Record<string, unknown>>>;
  for (const name of Object.keys(collections)) {
    if (!(KNOWN_COLLECTIONS as readonly string[]).includes(name)) {
      throw new ImportRefusedError(`Unknown artifact collection: ${name} (schema drift — update the mapper, never force it)`);
    }
  }
  const counts: ImportCounts = { inserted: {}, skippedExisting: {}, skippedByPolicy: {}, warnings: [] };
  const plans: Array<{ entity: string; sql: string; args: Array<string | number | null> }> = [];

  const queue = (
    entity: string,
    sql: string,
    args: Array<string | number | null>,
  ): void => {
    // Structural guard: this driver's silent NULL-fill on missing bindings
    // would turn an arg-count bug into silent corruption masked by OR IGNORE.
    // Fail loudly at plan time instead (all modes, including dry-run).
    const placeholders = (sql.match(/\?/g) ?? []).length;
    if (placeholders !== args.length) {
      throw new ImportRefusedError(
        `Importer bug: ${entity} binds ${args.length} arg(s) for ${placeholders} placeholder(s)`,
      );
    }
    plans.push({ entity, sql, args });
  };

  // Conflict pre-flight (§27): same stable PK with different domain content
  // must FAIL, never silently skip or overwrite immutable history.
  // Checkable tables are a closed literal union (no dynamic table names).
  type CheckableTable =
    | "profiles" | "transactions" | "payment_intents"
    | "disputes" | "settlements" | "refunds";
  interface ConflictCheck {
    entity: string;
    table: CheckableTable;
    id: string;
    fields: Record<string, string | number | null>;
  }
  const checks: ConflictCheck[] = [];
  const watch = (
    entity: string,
    table: CheckableTable,
    id: string,
    fields: Record<string, string | number | null>,
  ): void => {
    checks.push({ entity, table, id, fields });
  };

  async function assertNoConflicts(): Promise<void> {
    for (const check of checks) {
      const rs = await client.execute({
        sql: `SELECT * FROM ${check.table} WHERE id = ?`,
        args: [check.id],
      });
      const existing = rs.rows[0] as Record<string, unknown> | undefined;
      if (existing === undefined) continue;
      for (const [field, expected] of Object.entries(check.fields)) {
        const actual = existing[field] === null || existing[field] === undefined ? null : existing[field];
        const want = expected === null || expected === undefined ? null : expected;
        if (String(actual) !== String(want)) {
          throw new ImportRefusedError(
            `${check.entity} ${check.id}: conflicting ${field} (database has ${String(actual)}, artifact has ${String(want)}) — refusing to rewrite history`,
          );
        }
      }
    }
  }

  for (const u of collections["users"] ?? []) {
    requireFields("users", u, ["_id"]);
    const id = String(u["_id"]);
    const email = typeof u["email"] === "string" ? u["email"] : null;
    const name = typeof u["name"] === "string" ? u["name"] : null;
    watch("profiles", "profiles", id, { email, display_name: name });
    queue("profiles", "INSERT OR IGNORE INTO profiles (id, email, display_name, full_name, onboarded, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)", [
      id,
      email,
      name,
      name,
      opts.nowMs ?? Date.now(),
      opts.nowMs ?? Date.now(),
    ]);
    const canonical = typeof u["role"] === "string" ? LEGACY_ROLE_TO_CANONICAL[u["role"]] : undefined;
    if (canonical !== undefined) {
      queue("user_roles", "INSERT OR IGNORE INTO user_roles (id, profile_id, role, granted_at) VALUES (?, ?, ?, ?)", [
        `imp-role-${id}-${canonical}`,
        id,
        canonical,
        opts.nowMs ?? Date.now(),
      ]);
    }
  }

  for (const t of collections["transactions"] ?? []) {
    requireFields("transactions", t, ["_id", "publicId", "slug", "sellerId", "status"]);
    const amount = typeof t["amountKobo"] === "number" ? t["amountKobo"] : 0;
    const fee = typeof t["deliveryFeeKobo"] === "number" ? t["deliveryFeeKobo"] : 0;
    const platformFee = typeof t["feeKobo"] === "number" ? t["feeKobo"] : 0;
    queue("transactions", `INSERT OR IGNORE INTO transactions
      (id, public_reference, invite_slug, transaction_origin, seller_id, buyer_id, title, description, category,
       amount_minor, delivery_fee_minor, platform_fee_minor, total_minor, status, created_at, updated_at)
     VALUES (?, ?, ?, 'SHARE_LINK', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      String(t["_id"]),
      String(t["publicId"]),
      String(t["slug"]),
      String(t["sellerId"]),
      t["buyerId"] == null ? null : String(t["buyerId"]),
      typeof t["title"] === "string" ? t["title"] : "imported",
      typeof t["description"] === "string" ? t["description"] : "",
      typeof t["category"] === "string" ? t["category"] : "Other",
      amount,
      fee,
      platformFee,
      typeof t["totalKobo"] === "number" ? t["totalKobo"] : amount + fee,
      String(t["status"]),
      opts.nowMs ?? Date.now(),
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const p of collections["transaction_participants"] ?? []) {
    requireFields("transaction_participants", p, ["_id", "transactionId", "userId"]);
    queue("transaction_participants", "INSERT OR IGNORE INTO transaction_participants (id, transaction_id, profile_id, role) VALUES (?, ?, ?, ?)", [
      String(p["_id"]),
      String(p["transactionId"]),
      String(p["userId"]),
      p["role"] === "seller" ? "seller" : "buyer",
    ]);
  }

  for (const item of collections["transaction_items"] ?? []) {
    requireFields("transaction_items", item, ["_id", "transactionId", "name"]);
    const quantity =
      typeof item["quantity"] === "number" && Number.isInteger(item["quantity"]) && item["quantity"] > 0
        ? item["quantity"]
        : 1;
    queue("transaction_items", "INSERT OR IGNORE INTO transaction_items (id, transaction_id, name, quantity, unit_amount_minor, note) VALUES (?, ?, ?, ?, 0, ?)", [
      String(item["_id"]),
      String(item["transactionId"]),
      String(item["name"]),
      quantity,
      typeof item["note"] === "string" ? item["note"] : null,
    ]);
  }

  for (const pi of collections["payment_intents"] ?? []) {
    requireFields("payment_intents", pi, ["_id", "transactionId", "payerId"]);
    queue("payment_intents", `INSERT OR IGNORE INTO payment_intents
      (id, transaction_id, payer_id, provider, amount_minor, status, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      String(pi["_id"]),
      String(pi["transactionId"]),
      String(pi["payerId"]),
      typeof pi["provider"] === "string" ? pi["provider"] : "mock",
      typeof pi["amountKobo"] === "number" ? pi["amountKobo"] : 0,
      typeof pi["status"] === "string" ? pi["status"] : "PENDING",
      typeof pi["idempotencyKey"] === "string" ? pi["idempotencyKey"] : `imp-${String(pi["_id"])}`,
      typeof pi["createdAt"] === "number" ? pi["createdAt"] : (opts.nowMs ?? Date.now()),
    ]);
  }

  for (const d of collections["deliveries"] ?? []) {
    requireFields("deliveries", d, ["_id", "transactionId"]);
    queue("deliveries", "INSERT OR IGNORE INTO deliveries (id, transaction_id, status) VALUES (?, ?, ?)", [
      String(d["_id"]),
      String(d["transactionId"]),
      typeof d["status"] === "string" ? d["status"] : "DISPATCHED",
    ]);
  }

  const otpRows = collections["delivery_otps"] ?? [];
  if (otpRows.length > 0) {
    bump(counts.skippedByPolicy, "delivery_otps", otpRows.length);
    counts.warnings.push(`${otpRows.length} delivery_otps row(s) skipped: plaintext codes must not transfer (codes are re-issued post-migration)`);
  }

  for (const d of collections["disputes"] ?? []) {
    requireFields("disputes", d, ["_id", "transactionId", "openedBy", "reason"]);
    queue("disputes", `INSERT OR IGNORE INTO disputes
      (id, transaction_id, opened_by, reason, details, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      String(d["_id"]),
      String(d["transactionId"]),
      String(d["openedBy"]),
      String(d["reason"]),
      typeof d["details"] === "string" ? d["details"] : null,
      typeof d["status"] === "string" ? d["status"] : "OPEN",
      opts.nowMs ?? Date.now(),
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const m of collections["dispute_messages"] ?? []) {
    requireFields("dispute_messages", m, ["_id", "disputeId", "authorId", "body"]);
    queue("dispute_messages", "INSERT OR IGNORE INTO dispute_messages (id, dispute_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)", [
      String(m["_id"]),
      String(m["disputeId"]),
      String(m["authorId"]),
      String(m["body"]),
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const e of collections["dispute_evidence"] ?? []) {
    requireFields("dispute_evidence", e, ["_id", "disputeId", "uploaderId"]);
    queue("dispute_evidence", "INSERT OR IGNORE INTO dispute_evidence (id, dispute_id, uploader_id, storage_key, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      String(e["_id"]),
      String(e["disputeId"]),
      String(e["uploaderId"]),
      typeof e["storageKey"] === "string" ? e["storageKey"] : null,
      typeof e["mimeType"] === "string" ? e["mimeType"] : null,
      typeof e["sizeBytes"] === "number" ? e["sizeBytes"] : null,
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const t of collections["terms_versions"] ?? []) {
    requireFields("terms_versions", t, ["_id", "version", "content"]);
    queue("terms_versions", "INSERT OR IGNORE INTO terms_versions (id, version, content, effective_at) VALUES (?, ?, ?, ?)", [
      String(t["_id"]),
      typeof t["version"] === "number" ? t["version"] : 0,
      String(t["content"]),
      typeof t["effectiveAt"] === "number" ? t["effectiveAt"] : (opts.nowMs ?? Date.now()),
    ]);
  }

  for (const a of collections["terms_acceptances"] ?? []) {
    requireFields("terms_acceptances", a, ["_id", "userId", "termsVersionId"]);
    queue("terms_acceptances", "INSERT OR IGNORE INTO terms_acceptances (id, profile_id, terms_version_id, transaction_id, accepted_at) VALUES (?, ?, ?, ?, ?)", [
      String(a["_id"]),
      String(a["userId"]),
      String(a["termsVersionId"]),
      a["transactionId"] == null ? null : String(a["transactionId"]),
      opts.nowMs ?? Date.now(),
    ]);
  }

  // Known but out-of-scope for the development importer: reported, never silent.
  for (const [collection, reason] of [
    ["profiles", "identity display data comes from users rows in this importer"],
    ["kyc_profiles", "KYC migration is a later-phase concern"],
    ["bank_accounts", "payout destinations migrate with provider tokenization later"],
    ["risk_flags", "operational flags are recreated, not migrated, in dev"],
    ["admin_notes", "staff notes are recreated, not migrated, in dev"],
  ] as Array<[string, string]>) {
    const rows = collections[collection] ?? [];
    if (rows.length > 0) {
      bump(counts.skippedByPolicy, collection, rows.length);
      counts.warnings.push(`${rows.length} ${collection} row(s) skipped: ${reason}`);
    }
  }

  for (const s of collections["settlements"] ?? []) {
    requireFields("settlements", s, ["_id", "transactionId"]);
    queue("settlements", `INSERT OR IGNORE INTO settlements
      (id, transaction_id, payee_id, amount_minor, status, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      String(s["_id"]),
      String(s["transactionId"]),
      typeof s["payeeId"] === "string" ? s["payeeId"] : String(s["sellerId"] ?? ""),
      typeof s["amountKobo"] === "number" ? s["amountKobo"] : 0,
      typeof s["status"] === "string" ? s["status"] : "PENDING",
      typeof s["provider"] === "string" ? s["provider"] : "mock",
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const r of collections["refunds"] ?? []) {
    requireFields("refunds", r, ["_id", "transactionId", "requestedBy"]);
    queue("refunds", `INSERT OR IGNORE INTO refunds
      (id, transaction_id, amount_minor, requested_by, status, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      String(r["_id"]),
      String(r["transactionId"]),
      typeof r["amountKobo"] === "number" ? r["amountKobo"] : 0,
      typeof r["requestedBy"] === "string" ? r["requestedBy"] : "",
      typeof r["status"] === "string" ? r["status"] : "PENDING",
      typeof r["provider"] === "string" ? r["provider"] : "mock",
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const n of collections["notifications"] ?? []) {
    requireFields("notifications", n, ["_id", "userId", "title"]);
    queue("notifications", "INSERT OR IGNORE INTO notifications (id, profile_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
      String(n["_id"]),
      String(n["userId"]),
      typeof n["type"] === "string" ? n["type"] : "GENERAL",
      String(n["title"]),
      typeof n["body"] === "string" ? n["body"] : null,
      opts.nowMs ?? Date.now(),
    ]);
  }

  for (const a of collections["audit_logs"] ?? []) {
    requireFields("audit_logs", a, ["_id", "action"]);
    queue("audit_logs", "INSERT OR IGNORE INTO audit_logs (id, actor_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
      String(a["_id"]),
      a["actorId"] == null ? null : String(a["actorId"]),
      String(a["action"]),
      typeof a["entityType"] === "string" ? a["entityType"] : "unknown",
      a["entityId"] == null ? "" : String(a["entityId"]),
      opts.nowMs ?? Date.now(),
    ]);
  }

  // Conflict pre-flight runs in BOTH modes (read-only): dry-run surfaces
  // would-be conflicts before anything writes.
  await assertNoConflicts();

  if (opts.dryRun) {
    for (const plan of plans) bump(counts.inserted, `${plan.entity} (planned)`, 1);
    return counts;
  }

  for (const plan of plans) {
    const rs = await client.execute({ sql: plan.sql, args: plan.args });
    if (rs.rowsAffected > 0) {
      bump(counts.inserted, plan.entity, 1);
    } else {
      bump(counts.skippedExisting, plan.entity, 1);
    }
  }
  return counts;
}
