/**
 * Turso-backed TransactionRepository — READ methods implemented (Phase 4).
 * Write/transition methods throw: Convex remains authoritative for writes.
 * All SQL is parameterized; status/role filters map through allowlists.
 */
import type { Client } from "@libsql/client";
import type {
  Participant,
  StatusHistoryEntry,
  Transaction,
  TransactionOrigin,
  TransactionRepository,
  TransactionStatus,
} from "./interfaces/TransactionRepository.js";

const NOT_IMPLEMENTED =
  "Writes are not implemented in Phase 4 (Convex remains authoritative)";

type Row = Record<string, unknown>;

function toTransaction(row: Row): Transaction {
  return {
    id: String(row["id"]),
    publicReference: String(row["public_reference"]),
    inviteSlug: String(row["invite_slug"]),
    transactionOrigin: String(row["transaction_origin"]) as TransactionOrigin,
    sellerId: String(row["seller_id"]),
    buyerId: row["buyer_id"] === null ? null : String(row["buyer_id"]),
    title: String(row["title"]),
    description: String(row["description"] ?? ""),
    category: String(row["category"]),
    currency: String(row["currency"]),
    amountMinor: Number(row["amount_minor"]),
    deliveryFeeMinor: Number(row["delivery_fee_minor"]),
    platformFeeMinor: Number(row["platform_fee_minor"]),
    totalMinor: Number(row["total_minor"]),
    status: String(row["status"]) as TransactionStatus,
    inspectionDeadline: row["inspection_deadline"] === null ? null : Number(row["inspection_deadline"]),
    expiresAt: row["expires_at"] === null ? null : Number(row["expires_at"]),
    inspectionWindowDays: row["inspection_window_days"] === null ? null : Number(row["inspection_window_days"]),
    returnTerms: row["return_terms"] === null ? null : String(row["return_terms"]),
    disputeBlocked: Number(row["dispute_blocked"]) === 1,
    createdAt: Number(row["created_at"]),
    updatedAt: Number(row["updated_at"]),
  };
}

const TX_COLUMNS = `id, public_reference, invite_slug, transaction_origin, seller_id,
  buyer_id, title, description, category, currency, amount_minor, delivery_fee_minor,
  platform_fee_minor, total_minor, status, inspection_deadline, expires_at,
  inspection_window_days, return_terms, dispute_blocked, created_at, updated_at`;

export class TursoTransactionRepository implements TransactionRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async findById(id: string): Promise<Transaction | null> {
    const rs = await this.client.execute({
      sql: `SELECT ${TX_COLUMNS} FROM transactions WHERE id = ?`,
      args: [id],
    });
    const row = rs.rows[0] as Row | undefined;
    return row === undefined ? null : toTransaction(row);
  }

  async findByPublicReference(publicReference: string): Promise<Transaction | null> {
    const rs = await this.client.execute({
      sql: `SELECT ${TX_COLUMNS} FROM transactions WHERE public_reference = ?`,
      args: [publicReference],
    });
    const row = rs.rows[0] as Row | undefined;
    return row === undefined ? null : toTransaction(row);
  }

  async findByInviteSlug(slug: string): Promise<Transaction | null> {
    const rs = await this.client.execute({
      sql: `SELECT ${TX_COLUMNS} FROM transactions WHERE invite_slug = ?`,
      args: [slug],
    });
    const row = rs.rows[0] as Row | undefined;
    return row === undefined ? null : toTransaction(row);
  }

  async listForUser(
    profileId: string,
    limit: number,
    offset = 0,
    role: "all" | "seller" | "buyer" = "all",
    status?: TransactionStatus,
  ): Promise<{ items: Transaction[]; total: number }> {
    // Role/status interpolate ONLY through allowlisted branches below —
    // never raw user input.
    const conditions: string[] = [];
    const args: Array<string | number> = [profileId];
    if (role === "seller") {
      conditions.push("t.seller_id = ?");
    } else if (role === "buyer") {
      conditions.push("(t.buyer_id = ? OR EXISTS (SELECT 1 FROM transaction_participants p WHERE p.transaction_id = t.id AND p.profile_id = ? AND p.role = 'buyer'))");
      args.push(profileId);
    } else {
      conditions.push("(t.seller_id = ? OR t.buyer_id = ? OR EXISTS (SELECT 1 FROM transaction_participants p WHERE p.transaction_id = t.id AND p.profile_id = ?))");
      args.push(profileId, profileId);
    }
    if (status !== undefined) {
      conditions.push("t.status = ?");
      args.push(status);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const countRs = await this.client.execute({
      sql: `SELECT COUNT(*) AS total FROM transactions t ${where}`,
      args,
    });
    const total = Number((countRs.rows[0] as Row)["total"]);
    const rowsRs = await this.client.execute({
      sql: `SELECT ${TX_COLUMNS.split(",").map((c) => `t.${c.trim()}`).join(", ")}
            FROM transactions t ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });
    return { items: (rowsRs.rows as Row[]).map(toTransaction), total };
  }

  // Interface compatibility: legacy signature delegates with defaults.
  async listForProfile(profileId: string, limit: number): Promise<Transaction[]> {
    const { items } = await this.listForUser(profileId, limit);
    return items;
  }

  async participants(transactionId: string): Promise<Participant[]> {
    const rs = await this.client.execute({
      sql: "SELECT id, transaction_id, profile_id, role, email, accepted_at FROM transaction_participants WHERE transaction_id = ?",
      args: [transactionId],
    });
    return (rs.rows as Row[]).map((row) => ({
      id: String(row["id"]),
      transactionId: String(row["transaction_id"]),
      profileId: String(row["profile_id"]),
      role: String(row["role"]) as "buyer" | "seller",
      email: row["email"] === null ? null : String(row["email"]),
      acceptedAt: row["accepted_at"] === null ? null : Number(row["accepted_at"]),
    }));
  }

  async history(transactionId: string): Promise<StatusHistoryEntry[]> {
    const rs = await this.client.execute({
      sql: "SELECT id, transaction_id, actor_id, from_status, to_status, reason, created_at FROM transaction_status_history WHERE transaction_id = ? ORDER BY created_at ASC",
      args: [transactionId],
    });
    return (rs.rows as Row[]).map((row) => ({
      id: String(row["id"]),
      transactionId: String(row["transaction_id"]),
      actorId: row["actor_id"] === null ? null : String(row["actor_id"]),
      fromStatus: row["from_status"] === null ? null : (String(row["from_status"]) as TransactionStatus),
      toStatus: String(row["to_status"]) as TransactionStatus,
      reason: row["reason"] === null ? null : String(row["reason"]),
      createdAt: Number(row["created_at"]),
    }));
  }

  async create(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async transition(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async addParticipant(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
