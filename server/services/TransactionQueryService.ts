/**
 * TransactionQueryService — authorized transaction reads (Phase 4, §16).
 *
 * Receives a TRUSTED principal (resolved by API auth middleware, never from
 * request data), authorizes via the shared Phase 2 policy, reads through
 * the repository, and maps to safe DTOs. Route handlers contain no
 * authorization logic beyond calling these methods.
 */
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";
import {
  isTxBuyer,
  isTxParticipant,
  isTxSeller,
  requireAuthenticated,
} from "../../src/lib/auth/policy.js";
import type { TransactionRepository, Transaction } from "../repositories/interfaces/TransactionRepository.js";
import type { TursoUserRepository } from "../repositories/TursoUserRepository.js";
import type {
  InviteTransactionDto,
  PaginationDto,
  TransactionDetailDto,
  TransactionSummaryDto,
} from "../api/dto.js";
import type { Pagination, TransactionListFilter } from "../api/validation.js";

export class AuthorizationError extends Error {
  readonly hidden: boolean;
  constructor(message: string, hidden = false) {
    super(message);
    this.name = "AuthorizationError";
    this.hidden = hidden;
  }
}

/** Hard ceiling: no caller (present or future) pages unboundedly. */
export const MAX_SERVICE_PAGE_SIZE = 100;

function clampPaging(paging: Pagination): Pagination {
  const limit = Number.isFinite(paging.limit)
    ? Math.min(Math.max(1, Math.trunc(paging.limit)), MAX_SERVICE_PAGE_SIZE)
    : 20;
  const offset = Number.isFinite(paging.offset) ? Math.max(0, Math.trunc(paging.offset)) : 0;
  return { limit, offset };
}

function viewerRole(
  principal: AuthenticatedPrincipal,
  tx: Transaction,
  participantIds: readonly string[],
): TransactionSummaryDto["viewerRole"] {
  if (tx.sellerId === principal.userId) return "seller";
  if (tx.buyerId === principal.userId || participantIds.includes(principal.userId)) {
    return "buyer";
  }
  return "staff";
}

export class TransactionQueryService {
  private transactions: TransactionRepository;
  private users: TursoUserRepository;

  constructor(transactions: TransactionRepository, users: TursoUserRepository) {
    this.transactions = transactions;
    this.users = users;
  }

  private async participantIds(transactionId: string): Promise<string[]> {
    const parts = await this.transactions.participants(transactionId);
    return parts.map((p) => p.profileId);
  }

  async listMine(
    principal: AuthenticatedPrincipal | null,
    filter: TransactionListFilter,
    paging: Pagination,
  ): Promise<{ items: TransactionSummaryDto[]; pagination: PaginationDto }> {
    const me = requireAuthenticated(principal);
    const page = clampPaging(paging);
    const { items, total } = await this.transactions.listForUser(
      me.userId,
      page.limit,
      page.offset,
      filter.role,
      filter.status,
    );
    const summaries: TransactionSummaryDto[] = [];
    for (const tx of items) {
      const ids = await this.participantIds(tx.id);
      summaries.push(this.toSummary(tx, viewerRole(me, tx, ids)));
    }
    return {
      items: summaries,
      pagination: { limit: page.limit, offset: page.offset, total },
    };
  }

  async detail(
    principal: AuthenticatedPrincipal | null,
    publicReference: string,
  ): Promise<TransactionDetailDto> {
    const me = requireAuthenticated(principal);
    const tx = await this.transactions.findByPublicReference(publicReference);
    // Existence-hiding: missing and forbidden share one error (hidden=true).
    const ids = tx === null ? [] : await this.participantIds(tx.id);
    if (tx === null || !isTxParticipant(me, this.membershipOf(tx, ids))) {
      throw new AuthorizationError("Not found", true);
    }
    const counterpartyId = tx.sellerId === me.userId ? tx.buyerId : tx.sellerId;
    const counterparty =
      counterpartyId === null ? null : await this.users.findProfileById(counterpartyId);
    return {
      ...this.toSummary(tx, viewerRole(me, tx, ids)),
      description: tx.description,
      deliveryFeeMinor: tx.deliveryFeeMinor,
      platformFeeMinor: tx.platformFeeMinor,
      inspectionDeadline: tx.inspectionDeadline,
      counterpartyDisplayName: counterparty?.displayName ?? null,
      createdAt: tx.createdAt,
    };
  }

  /**
   * Safe invite preview: NO authentication (high-entropy slug IS the
   * capability), minimum fields only. Never buyer/contact/internal data.
   */
  async invitePreview(slug: string): Promise<InviteTransactionDto | null> {
    const tx = await this.transactions.findByInviteSlug(slug);
    if (tx === null) return null;
    if (tx.status !== "PENDING_BUYER_ACCEPTANCE" && tx.status !== "AWAITING_PAYMENT") {
      return null;
    }
    const seller = await this.users.findProfileById(tx.sellerId);
    return {
      title: tx.title,
      description: tx.description,
      category: tx.category,
      currency: tx.currency,
      amountMinor: tx.amountMinor,
      deliveryFeeMinor: tx.deliveryFeeMinor,
      totalMinor: tx.totalMinor,
      status: tx.status,
      inspectionWindowDays: tx.inspectionWindowDays,
      returnTerms: tx.returnTerms,
      sellerDisplayName: seller?.displayName ?? null,
    };
  }

  private membershipOf(tx: Transaction, participantIds: readonly string[]) {
    return {
      sellerId: tx.sellerId,
      buyerId: tx.buyerId,
      participantIds,
    };
  }

  private toSummary(
    tx: Transaction,
    role: TransactionSummaryDto["viewerRole"],
  ): TransactionSummaryDto {
    return {
      publicReference: tx.publicReference,
      title: tx.title,
      category: tx.category,
      currency: tx.currency,
      amountMinor: tx.amountMinor,
      totalMinor: tx.totalMinor,
      status: tx.status,
      viewerRole: role,
      updatedAt: tx.updatedAt,
    };
  }

  /** Test/support helper: buyer-or-seller assertion without leaking which. */
  assertParticipant(
    principal: AuthenticatedPrincipal | null,
    tx: Transaction,
    participantIds: readonly string[],
  ): void {
    const me = requireAuthenticated(principal);
    if (!isTxParticipant(me, this.membershipOf(tx, participantIds))) {
      throw new AuthorizationError("Not found", true);
    }
  }
}

export { isTxBuyer, isTxSeller };
