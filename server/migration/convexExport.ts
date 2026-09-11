/**
 * Convex export mapping skeleton (Phase 3, §48 — DEVELOPMENT ONLY).
 *
 * Future cutover tooling will read an EXPLICIT local Convex export artifact
 * (a JSON file path passed by the operator) and map records into Turso.
 * This module defines the entity mapping and a dry-run inspector that
 * reports counts and ID-shape validity WITHOUT writing anything and WITHOUT
 * connecting to any Convex deployment. Production use requires the
 * reconciliation gates in docs/migration/convex-to-turso-reconciliation.md.
 */

import { readFileSync } from "node:fs";

export const EXPORT_ENTITY_MAP = {
  users: "profiles",
  transactions: "transactions",
  transaction_participants: "transaction_participants",
  transaction_items: "transaction_items",
  transaction_media: "transaction_media",
  transaction_status_history: "transaction_status_history",
  payment_intents: "payment_intents",
  payment_events: "payment_events",
  ledger_accounts: "ledger_accounts",
  ledger_entries: "ledger_entries",
  deliveries: "deliveries",
  delivery_events: "delivery_events",
  delivery_otps: "delivery_otps",
  disputes: "disputes",
  dispute_messages: "dispute_messages",
  dispute_evidence: "dispute_evidence",
  settlements: "settlements",
  refunds: "refunds",
  notifications: "notifications",
  audit_logs: "audit_logs",
  risk_flags: "risk_flags",
  admin_notes: "admin_notes",
  profiles: "profiles",
  kyc_profiles: "kyc_profiles",
  bank_accounts: "bank_accounts",
  terms_versions: "terms_versions",
  terms_acceptances: "terms_acceptances",
} as const;

export type ExportEntity = keyof typeof EXPORT_ENTITY_MAP;

export interface ExportArtifact {
  exportedAt: number;
  source: string;
  collections: Partial<Record<ExportEntity, Array<Record<string, unknown>>>>;
}

export interface ImportDryRun {
  entities: Array<{ entity: ExportEntity; target: string; count: number }>;
  totalRecords: number;
}

/**
 * Inspect an explicit local artifact file. Reads ONLY that path; performs
 * no network access and writes nothing. Rejects non-artifact shapes loudly.
 */
export function inspectExportArtifact(artifactPath: string): ImportDryRun {
  const raw = readFileSync(artifactPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ExportArtifact>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed["exportedAt"] !== "number" ||
    typeof parsed["collections"] !== "object" ||
    parsed["collections"] === null
  ) {
    throw new Error("Not a DealSure export artifact (missing exportedAt/collections)");
  }
  const entities: ImportDryRun["entities"] = [];
  let totalRecords = 0;
  for (const [entity, target] of Object.entries(EXPORT_ENTITY_MAP)) {
    const rows = (parsed["collections"] as Record<string, unknown[]>)[entity] ?? [];
    if (!Array.isArray(rows)) {
      throw new Error(`Artifact collection ${entity} is not an array`);
    }
    entities.push({ entity: entity as ExportEntity, target, count: rows.length });
    totalRecords += rows.length;
  }
  return { entities, totalRecords };
}
