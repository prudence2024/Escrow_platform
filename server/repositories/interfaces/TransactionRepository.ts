/**
 * TransactionRepository — core transaction engine persistence (§37).
 *
 * Status transitions belong to the trusted transition service; this
 * contract exposes the primitives (conditional state move + history
 * append) that the service composes atomically. Status values are the
 * closed canonical set — never arbitrary strings.
 */

export type TransactionStatus =
  | "DRAFT"
  | "PENDING_BUYER_ACCEPTANCE"
  | "AWAITING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_SECURED"
  | "READY_FOR_DELIVERY"
  | "DISPATCHED"
  | "DELIVERED_PENDING_INSPECTION"
  | "ACCEPTED"
  | "RELEASE_PENDING"
  | "SETTLED"
  | "DISPUTED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "CANCELLED"
  | "EXPIRED";

export type TransactionOrigin =
  | "SHARE_LINK"
  | "MARKETPLACE"
  | "MERCHANT_CHECKOUT"
  | "API"
  | "ADMIN_ASSISTED"
  | "PARTNER";

export interface Transaction {
  id: string;
  publicReference: string;
  inviteSlug: string;
  transactionOrigin: TransactionOrigin;
  sellerId: string;
  buyerId: string | null;
  title: string;
  description: string;
  category: string;
  currency: string;
  amountMinor: number;
  deliveryFeeMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  status: TransactionStatus;
  inspectionDeadline: number | null;
  expiresAt: number | null;
  inspectionWindowDays: number | null;
  returnTerms: string | null;
  disputeBlocked: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Participant {
  id: string;
  transactionId: string;
  profileId: string;
  role: "buyer" | "seller";
  email: string | null;
  acceptedAt: number | null;
}

export interface StatusHistoryEntry {
  id: string;
  transactionId: string;
  actorId: string | null;
  fromStatus: TransactionStatus | null;
  toStatus: TransactionStatus;
  reason: string | null;
  createdAt: number;
}

export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByPublicReference(publicReference: string): Promise<Transaction | null>;
  findByInviteSlug(slug: string): Promise<Transaction | null>;
  listForUser(
    profileId: string,
    limit: number,
    offset?: number,
    role?: "all" | "seller" | "buyer",
    status?: TransactionStatus,
  ): Promise<{ items: Transaction[]; total: number }>;
  listForProfile(profileId: string, limit: number): Promise<Transaction[]>;
  create(input: Omit<Transaction, "id" | "createdAt" | "updatedAt">): Promise<Transaction>;
  /**
   * Conditional state move + history append in ONE database transaction.
   * Fails when the current status differs from `expectedFrom`.
   */
  transition(
    id: string,
    expectedFrom: TransactionStatus,
    to: TransactionStatus,
    actorId: string | null,
    reason?: string,
  ): Promise<Transaction>;
  addParticipant(input: Omit<Participant, "id">): Promise<Participant>;
  participants(transactionId: string): Promise<Participant[]>;
  history(transactionId: string): Promise<StatusHistoryEntry[]>;

  /** Atomic draft create: transaction + participant + items + status-history + idempotency + audit. */
  createDraft(input: {
    transaction: Omit<Transaction, "createdAt" | "updatedAt" | "version">;
    participant: Participant;
    items: Array<{ name: string; note: string | null; quantity: number; unitAmountMinor: number }>;
    statusHistoryId: string;
    auditEventId: string;
    idempotencyKey: string;
    idempotencyScope: string;
    idempotencyActorId: string;
    idempotencyRequestHash: string;
    idempotencyResultId: string;
  }): Promise<Transaction>;

  /** Find a draft owned by the given profile for editing. Returns null if not found/not owner/not DRAFT. */
  findDraftForOwner(publicReference: string, ownerProfileId: string): Promise<Transaction | null>;

  /** Optimistic-concurrency update of a DRAFT. Returns null if version mismatch. */
  updateDraft(
    publicReference: string,
    ownerProfileId: string,
    expectedVersion: number,
    patch: {
      title?: string;
      description?: string;
      category?: string;
      deliveryFeeMinor?: number;
      inspectionWindowDays?: number | null;
      sellerTerms?: string | null;
    },
    amountMinor: number,
    totalMinor: number,
    platformFeeMinor: number,
    items: Array<{ name: string; note: string | null; quantity: number; unitAmountMinor: number }>,
    auditEventId: string,
  ): Promise<Transaction | null>;

  /** List items for a transaction. */
  listItems(transactionId: string): Promise<Array<{ name: string; note: string | null; quantity: number; unitAmountMinor: number }>>;
}
