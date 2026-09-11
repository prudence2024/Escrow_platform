/**
 * Parity snapshot schema + builders (Phase 5, §9–§10, §13–§14).
 *
 * One provider-independent shape both sides normalize into. Identity is
 * compared by STABLE BUSINESS KEYS (profile email, transaction public
 * reference) — never by provider-internal document IDs, which are not
 * expected to match across systems.
 */
import type { Client } from "@libsql/client";

export interface ParityProfile {
  email: string;
  displayName: string | null;
  roles: string[];
}

export interface ParityTx {
  publicReference: string;
  status: string;
  sellerEmail: string | null;
  buyerEmail: string | null;
  participantEmails: string[];
  amountMinor: number;
  deliveryFeeMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  origin: string;
  itemCount: number;
  itemQuantityTotal: number;
  deliveryStatus: string | null;
  disputeStatus: string | null;
  paymentStatus: string | null;
  settlementStatus: string | null;
  refundTotalMinor: number;
}

export interface ParitySnapshot {
  exportedAt: number;
  source: string;
  profiles: ParityProfile[];
  transactions: ParityTx[];
}

/** Canonical lifecycle — the ONLY comparable status vocabulary. */
export const CANONICAL_STATUSES = [
  "DRAFT", "PENDING_BUYER_ACCEPTANCE", "AWAITING_PAYMENT", "PAYMENT_PROCESSING",
  "PAYMENT_SECURED", "READY_FOR_DELIVERY", "DISPATCHED", "DELIVERED_PENDING_INSPECTION",
  "ACCEPTED", "RELEASE_PENDING", "SETTLED", "DISPUTED", "REFUND_PENDING",
  "REFUNDED", "CANCELLED", "EXPIRED",
] as const;

/** Normalize a raw status; null = UNMAPPED (a parity failure, never silent). */
export function normalizeStatus(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return (CANONICAL_STATUSES as readonly string[]).includes(raw) ? raw : null;
}

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Build a snapshot from Turso via read-only SELECTs (never writes). */
export async function buildTursoSnapshot(client: Client, exportedAt: number = Date.now()): Promise<ParitySnapshot> {
  const profilesById = new Map<string, { email: string; displayName: string | null }>();
  const profileRows = await client.execute("SELECT id, email, display_name FROM profiles");
  for (const row of profileRows.rows as Row[]) {
    profilesById.set(String(row["id"]), {
      email: str(row["email"]) ?? "",
      displayName: str(row["display_name"]),
    });
  }
  const rolesByProfile = new Map<string, string[]>();
  const roleRows = await client.execute("SELECT profile_id, role FROM user_roles WHERE revoked_at IS NULL");
  for (const row of roleRows.rows as Row[]) {
    const key = String(row["profile_id"]);
    const list = rolesByProfile.get(key) ?? [];
    list.push(String(row["role"]));
    rolesByProfile.set(key, list);
  }
  const profiles: ParityProfile[] = [...profilesById.entries()].map(([id, p]) => ({
    email: p.email,
    displayName: p.displayName,
    roles: (rolesByProfile.get(id) ?? []).sort(),
  }));

  const txRows = await client.execute(
    `SELECT id, public_reference, status, seller_id, buyer_id, amount_minor,
            delivery_fee_minor, platform_fee_minor, total_minor, currency, transaction_origin
     FROM transactions ORDER BY public_reference ASC`,
  );
  const transactions: ParityTx[] = [];
  for (const row of txRows.rows as Row[]) {
    const txId = String(row["id"]);
    const parts = await client.execute({
      sql: "SELECT profile_id, role FROM transaction_participants WHERE transaction_id = ?",
      args: [txId],
    });
    const participantEmails: string[] = [];
    for (const p of parts.rows as Row[]) {
      const email = profilesById.get(String(p["profile_id"]))?.email;
      if (email !== undefined && email !== "") participantEmails.push(email);
    }
    const items = await client.execute({
      sql: "SELECT COUNT(*) AS c, COALESCE(SUM(quantity), 0) AS q FROM transaction_items WHERE transaction_id = ?",
      args: [txId],
    });
    const itemRow = items.rows[0] as Row;
    const delivery = await client.execute({
      sql: "SELECT status FROM deliveries WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [txId],
    });
    const dispute = await client.execute({
      sql: "SELECT status FROM disputes WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [txId],
    });
    const payment = await client.execute({
      sql: "SELECT status FROM payment_intents WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [txId],
    });
    const settlement = await client.execute({
      sql: "SELECT status FROM settlements WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
      args: [txId],
    });
    const refunds = await client.execute({
      sql: "SELECT COALESCE(SUM(amount_minor), 0) AS t FROM refunds WHERE transaction_id = ? AND status IN ('PENDING', 'PAID')",
      args: [txId],
    });
    const first = (rs: { rows: unknown[] }): Row | null =>
      (rs.rows[0] as Row | undefined) ?? null;
    const sellerEmail = profilesById.get(String(row["seller_id"]))?.email ?? null;
    const buyerId = row["buyer_id"];
    transactions.push({
      publicReference: String(row["public_reference"]),
      status: String(row["status"]),
      sellerEmail,
      buyerEmail: buyerId === null ? null : (profilesById.get(String(buyerId))?.email ?? null),
      participantEmails: participantEmails.sort(),
      amountMinor: num(row["amount_minor"]),
      deliveryFeeMinor: num(row["delivery_fee_minor"]),
      platformFeeMinor: num(row["platform_fee_minor"]),
      totalMinor: num(row["total_minor"]),
      currency: String(row["currency"]),
      origin: String(row["transaction_origin"]),
      itemCount: num(itemRow["c"]),
      itemQuantityTotal: num(itemRow["q"]),
      deliveryStatus: ((d) => (d === null ? null : str(d["status"])))(first(delivery)),
      disputeStatus: ((d) => (d === null ? null : str(d["status"])))(first(dispute)),
      paymentStatus: ((d) => (d === null ? null : str(d["status"])))(first(payment)),
      settlementStatus: ((d) => (d === null ? null : str(d["status"])))(first(settlement)),
      refundTotalMinor: num((first(refunds) ?? {})["t"]),
    });
  }
  return { exportedAt, source: "turso", profiles, transactions };
}

/** Minimal Convex export artifact shape (explicit local file, §17). */
export interface ConvexExportArtifact {
  exportedAt: number;
  source: string;
  collections: Record<string, Array<Record<string, unknown>>>;
}

const LEGACY_ROLE_TO_CANONICAL: Record<string, string> = {
  user: "buyer",
  seller: "seller",
  admin: "super_admin",
  ops: "operations",
};

/**
 * Normalize an explicit Convex export artifact into the shared snapshot.
 * Identity maps by EMAIL (stable business key); statuses must be canonical
 * or the row is flagged downstream (normalizeStatus → null).
 */
export function normalizeConvexSnapshot(artifact: ConvexExportArtifact): ParitySnapshot {
  const usersById = new Map<string, { email: string; name: string | null; role: string | null }>();
  for (const u of artifact.collections["users"] ?? []) {
    usersById.set(String(u["_id"]), {
      email: typeof u["email"] === "string" ? u["email"] : "",
      name: typeof u["name"] === "string" ? u["name"] : null,
      role: typeof u["role"] === "string" ? u["role"] : null,
    });
  }
  const profiles: ParityProfile[] = [...usersById.values()].map((u) => ({
    email: u.email,
    displayName: u.name,
    roles:
      u.role !== null && LEGACY_ROLE_TO_CANONICAL[u.role] !== undefined
        ? [LEGACY_ROLE_TO_CANONICAL[u.role]]
        : [],
  }));

  const participantsByTx = new Map<string, string[]>();
  for (const p of artifact.collections["transaction_participants"] ?? []) {
    const list = participantsByTx.get(String(p["transactionId"])) ?? [];
    const email = usersById.get(String(p["userId"]))?.email;
    if (email !== undefined && email !== "") list.push(email);
    participantsByTx.set(String(p["transactionId"]), list);
  }
  const itemsByTx = new Map<string, Array<Record<string, unknown>>>();
  for (const item of artifact.collections["transaction_items"] ?? []) {
    const list = itemsByTx.get(String(item["transactionId"])) ?? [];
    list.push(item);
    itemsByTx.set(String(item["transactionId"]), list);
  }
  const latestByTx = (collection: string, txField: string): Map<string, Record<string, unknown>> => {
    const out = new Map<string, Record<string, unknown>>();
    for (const row of artifact.collections[collection] ?? []) {
      out.set(String(row[txField]), row);
    }
    return out;
  };
  const deliveries = latestByTx("deliveries", "transactionId");
  const disputes = latestByTx("disputes", "transactionId");
  const payments = latestByTx("payment_intents", "transactionId");
  const settlements = latestByTx("settlements", "transactionId");
  const refundsByTx = new Map<string, number>();
  for (const r of artifact.collections["refunds"] ?? []) {
    if (r["status"] === "PENDING" || r["status"] === "PAID") {
      const key = String(r["transactionId"]);
      refundsByTx.set(key, (refundsByTx.get(key) ?? 0) + (typeof r["amountKobo"] === "number" ? r["amountKobo"] : 0));
    }
  }

  const transactions: ParityTx[] = [];
  for (const t of artifact.collections["transactions"] ?? []) {
    const txId = String(t["_id"]);
    const seller = usersById.get(String(t["sellerId"]));
    const buyer = t["buyerId"] == null ? null : usersById.get(String(t["buyerId"]));
    const items = itemsByTx.get(txId) ?? [];
    const pick = (m: Map<string, Record<string, unknown>>, field: string): string | null => {
      const row = m.get(txId);
      return row === undefined ? null : str(row[field]);
    };
    transactions.push({
      publicReference: String(t["publicId"]),
      status: typeof t["status"] === "string" ? t["status"] : "",
      sellerEmail: seller?.email ?? null,
      buyerEmail: buyer?.email ?? null,
      participantEmails: (participantsByTx.get(txId) ?? []).sort(),
      amountMinor: num(t["amountKobo"]),
      deliveryFeeMinor: num(t["deliveryFeeKobo"]),
      platformFeeMinor: num(t["feeKobo"]),
      totalMinor: num(t["totalKobo"]),
      currency: typeof t["currency"] === "string" ? t["currency"] : "NGN",
      origin: "SHARE_LINK",
      itemCount: items.length,
      itemQuantityTotal: items.length,
      deliveryStatus: pick(deliveries, "status"),
      disputeStatus: pick(disputes, "status"),
      paymentStatus: pick(payments, "status"),
      settlementStatus: pick(settlements, "status"),
      refundTotalMinor: refundsByTx.get(txId) ?? 0,
    });
  }
  transactions.sort((a, b) => (a.publicReference < b.publicReference ? -1 : 1));
  return { exportedAt: artifact.exportedAt, source: "convex", profiles, transactions };
}
