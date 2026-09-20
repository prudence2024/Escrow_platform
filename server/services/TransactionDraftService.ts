/**
 * TransactionDraftService — private draft create/edit (Phase 7, §25).
 *
 * Owns: authorization, business validation, state enforcement, money
 * calculation, idempotency, request fingerprinting, DB transaction,
 * audit context, repository orchestration, safe DTO generation.
 *
 * The Hono route handler mostly: authenticate → validate transport input →
 * call service → map result/error.
 */
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";
import type { TransactionRepository, Transaction } from "../repositories/interfaces/TransactionRepository.js";
import { newId, newPublicReference, newInviteSlug } from "../domain/ids.js";
import {
  assertMinorAmount,
  assertTransactionMinorAmount,
  MAX_TRANSACTION_MINOR,
} from "../domain/money.js";
import type { CreateDraftInput, EditDraftInput } from "../api/schemas/draft.js";
import {
  createHash,
} from "node:crypto";

export interface DraftDto {
  publicReference: string;
  status: string;
  title: string;
  description: string;
  category: string;
  currency: string;
  amountMinor: number;
  deliveryFeeMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  items: Array<{ name: string; note: string | null; quantity: number; unitAmountMinor: number }>;
  transactionOrigin: string;
  inspectionWindowDays: number | null;
  sellerTerms: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDraftResult {
  draft: DraftDto;
  created: true;
}

export interface EditDraftResult {
  draft: DraftDto;
  updated: true;
}

export class DraftServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "DraftServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const NGN_ONLY = "NGN";

function computeItemTotal(items: CreateDraftInput["items"]): number {
  let total = 0;
  for (const item of items) {
    const lineTotal = item.unitAmountMinor * item.quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new DraftServiceError("BAD_REQUEST", 400, "Item total exceeds safe integer range");
    }
    total += lineTotal;
    if (!Number.isSafeInteger(total)) {
      throw new DraftServiceError("BAD_REQUEST", 400, "Combined item total exceeds safe integer range");
    }
  }
  return total;
}

function toDto(tx: Transaction, items: Array<{ name: string; note: string | null; quantity: number; unitAmountMinor: number }>): DraftDto {
  return {
    publicReference: tx.publicReference,
    status: tx.status,
    title: tx.title,
    description: tx.description,
    category: tx.category,
    currency: tx.currency,
    amountMinor: tx.amountMinor,
    deliveryFeeMinor: tx.deliveryFeeMinor,
    platformFeeMinor: tx.platformFeeMinor,
    totalMinor: tx.totalMinor,
    items,
    transactionOrigin: tx.transactionOrigin,
    inspectionWindowDays: tx.inspectionWindowDays,
    sellerTerms: tx.returnTerms,
    version: tx.version,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

export class TransactionDraftService {
  private txRepo: TransactionRepository;
  constructor(txRepo: TransactionRepository) {
    this.txRepo = txRepo;
  }

  /**
   * Create a private transaction draft.
   * Atomic: transaction + participant + items + status-history + idempotency + audit.
   */
  async createDraft(
    principal: AuthenticatedPrincipal,
    input: CreateDraftInput,
    idempotencyKey: string,
    requestId: string,
  ): Promise<CreateDraftResult> {
    void requestId;
    // 1. Authorization: guest denied
    if (principal.isAnonymous) {
      throw new DraftServiceError("UNAUTHENTICATED", 401, "Guest users cannot create drafts");
    }

    // 2. Currency enforcement (MVP: NGN only)
    if (input.currency !== NGN_ONLY) {
      throw new DraftServiceError("BAD_REQUEST", 400, `Only ${NGN_ONLY} is supported`);
    }

    // 3. Money validation — non-negative integer for components
    assertMinorAmount(input.deliveryFeeMinor, "deliveryFeeMinor");
    for (const item of input.items) {
      assertMinorAmount(item.unitAmountMinor, `unitAmountMinor (${item.name})`);
    }

    // 4. Server-computed totals — transaction-scale ceiling
    const amountMinor = computeItemTotal(input.items);
    assertTransactionMinorAmount(amountMinor, "amountMinor (computed from items)");

    const totalMinor = amountMinor + input.deliveryFeeMinor;
    if (totalMinor > MAX_TRANSACTION_MINOR) {
      throw new DraftServiceError("AMOUNT_LIMIT_EXCEEDED", 400, "Total exceeds business limit");
    }

    // Platform fee: currently zero (promo)
    const platformFeeMinor = 0;

    // 5. Resolve seller profile (trusted principal → Turso profile)
    // The principal.userId IS the profile ID in Turso (1:1 mapping from Convex)
    const sellerId = principal.userId;

    // 6. Generate server-side IDs
    const txId = newId();
    const publicReference = newPublicReference();
    const inviteSlug = newInviteSlug();
    const participantId = newId();
    const statusHistoryId = newId();
    const auditEventId = newId();
    const idempotencyResultId = newId();

    // 7. Compute request fingerprint (deterministic, canonicalized)
    const fingerprintPayload = JSON.stringify({
      title: input.title,
      description: input.description,
      category: input.category,
      currency: input.currency,
      items: input.items.map((i) => ({
        name: i.name,
        note: i.note ?? null,
        quantity: i.quantity,
        unitAmountMinor: i.unitAmountMinor,
      })),
      deliveryFeeMinor: input.deliveryFeeMinor,
      inspectionWindowDays: input.inspectionWindowDays ?? null,
      sellerTerms: input.sellerTerms ?? null,
    });
    const requestHash = createHash("sha256").update(fingerprintPayload).digest("hex");

    // 8. Idempotency scope: actor + operation
    const idempotencyScope = `draft:create:${sellerId}`;

    // 9. Atomic DB write
    try {
      const tx = await this.txRepo.createDraft({
        transaction: {
          id: txId,
          publicReference,
          inviteSlug,
          transactionOrigin: "SHARE_LINK",
          sellerId,
          buyerId: null,
          title: input.title,
          description: input.description,
          category: input.category,
          currency: input.currency,
          amountMinor,
          deliveryFeeMinor: input.deliveryFeeMinor,
          platformFeeMinor,
          totalMinor,
          status: "DRAFT",
          inspectionDeadline: null,
          expiresAt: null,
          inspectionWindowDays: input.inspectionWindowDays ?? null,
          returnTerms: input.sellerTerms ?? null,
          disputeBlocked: false,
        },
        participant: {
          id: participantId,
          transactionId: txId,
          profileId: sellerId,
          role: "seller",
          email: principal.email ?? null,
          acceptedAt: null,
        },
        items: input.items.map((i) => ({
          name: i.name,
          note: i.note ?? null,
          quantity: i.quantity,
          unitAmountMinor: i.unitAmountMinor,
        })),
        statusHistoryId,
        auditEventId,
        idempotencyKey,
        idempotencyScope,
        idempotencyActorId: sellerId,
        idempotencyRequestHash: requestHash,
        idempotencyResultId,
      });

      return {
        draft: toDto(tx, input.items.map((i) => ({
          name: i.name,
          note: i.note ?? null,
          quantity: i.quantity,
          unitAmountMinor: i.unitAmountMinor,
        }))),
        created: true,
      };
    } catch (error: unknown) {
      // Idempotency: if the unique constraint on (scope, key) fires,
      // check if the existing result matches
      const msg = error instanceof Error ? error.message : "";
      if (/UNIQUE|idempotency/i.test(msg)) {
        // Look up existing idempotency result
        const existing = await this.txRepo.findByPublicReference(publicReference);
        if (existing) {
          throw new DraftServiceError("IDEMPOTENCY_CONFLICT", 409, "Different request with same idempotency key");
        }
        throw new DraftServiceError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key conflict");
      }
      throw error;
    }
  }

  /**
   * Edit a private transaction draft with optimistic concurrency.
   */
  async editDraft(
    principal: AuthenticatedPrincipal,
    publicReference: string,
    input: EditDraftInput,
    requestId: string,
  ): Promise<EditDraftResult> {
    void requestId;
    // 1. Authorization: guest denied
    if (principal.isAnonymous) {
      throw new DraftServiceError("UNAUTHENTICATED", 401, "Guest users cannot edit drafts");
    }

    const sellerId = principal.userId;

    // 2. Find draft owned by this seller
    const existing = await this.txRepo.findDraftForOwner(publicReference, sellerId);
    if (existing === null) {
      throw new DraftServiceError("NOT_FOUND", 404, "Draft not found");
    }

    // 3. Verify status is still DRAFT
    if (existing.status !== "DRAFT") {
      throw new DraftServiceError("DRAFT_NOT_EDITABLE", 409, "Draft is no longer editable");
    }

    // 4. Build patch from allowed fields only
    const patch: {
      title?: string;
      description?: string;
      category?: string;
      deliveryFeeMinor?: number;
      inspectionWindowDays?: number | null;
      sellerTerms?: string | null;
    } = {};

    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.category !== undefined) patch.category = input.category;
    if (input.deliveryFeeMinor !== undefined) {
      assertMinorAmount(input.deliveryFeeMinor, "deliveryFeeMinor");
      patch.deliveryFeeMinor = input.deliveryFeeMinor;
    }
    if (input.inspectionWindowDays !== undefined) patch.inspectionWindowDays = input.inspectionWindowDays;
    if (input.sellerTerms !== undefined) patch.sellerTerms = input.sellerTerms;

    // 5. Compute updated totals if items changed
    let amountMinor = existing.amountMinor;
    let totalMinor = existing.totalMinor;
    const platformFeeMinor = existing.platformFeeMinor;

    const itemsToUpdate = input.items?.map((i) => ({
      name: i.name,
      note: i.note ?? null,
      quantity: i.quantity,
      unitAmountMinor: i.unitAmountMinor,
    })) ?? [];

    if (input.items !== undefined) {
      amountMinor = computeItemTotal(input.items);
      assertTransactionMinorAmount(amountMinor, "amountMinor (computed from items)");
      totalMinor = amountMinor + (patch.deliveryFeeMinor ?? existing.deliveryFeeMinor);
      if (totalMinor > MAX_TRANSACTION_MINOR) {
        throw new DraftServiceError("AMOUNT_LIMIT_EXCEEDED", 400, "Total exceeds business limit");
      }
    } else if (patch.deliveryFeeMinor !== undefined) {
      totalMinor = existing.amountMinor + patch.deliveryFeeMinor;
      if (totalMinor > MAX_TRANSACTION_MINOR) {
        throw new DraftServiceError("AMOUNT_LIMIT_EXCEEDED", 400, "Total exceeds business limit");
      }
    }

    // 6. Optimistic concurrency update
    const auditEventId = newId();
    const updated = await this.txRepo.updateDraft(
      publicReference,
      sellerId,
      input.expectedVersion,
      patch,
      amountMinor,
      totalMinor,
      platformFeeMinor,
      itemsToUpdate,
      auditEventId,
    );

    if (updated === null) {
      throw new DraftServiceError("VERSION_CONFLICT", 409, "Version conflict — draft was modified");
    }

    // 7. Fetch current items for DTO
    const currentItems = itemsToUpdate.length > 0
      ? itemsToUpdate
      : await this.txRepo.listItems(updated.id);

    return {
      draft: toDto(updated, currentItems),
      updated: true,
    };
  }
}
