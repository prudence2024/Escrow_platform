/**
 * API input validation (Phase 4, §11, §13, §24).
 * Zod at every boundary: params, query, pagination, filters. Only
 * allowlisted enums/columns ever reach SQL; sort direction is mapped
 * through a trusted enum (no raw ORDER BY passthrough).
 */
import { z } from "zod";

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function parsePagination(query: Record<string, string | string[] | undefined>): Pagination {
  const result = paginationSchema.safeParse({
    limit: firstQueryValue(query["limit"]),
    offset: firstQueryValue(query["offset"]),
  });
  if (!result.success) {
    // Clamp instead of rejecting: oversized pages shrink to the maximum,
    // malformed values fall back to defaults. Never allow ?limit=1000000.
    return {
      limit: clampPageSize(Number(firstQueryValue(query["limit"]))),
      offset: Math.max(0, Math.trunc(Number(firstQueryValue(query["offset"]))) || 0),
    };
  }
  return result.data;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(value), MAX_PAGE_SIZE);
}

export const TRANSACTION_STATUSES = [
  "DRAFT",
  "PENDING_BUYER_ACCEPTANCE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAYMENT_SECURED",
  "READY_FOR_DELIVERY",
  "DISPATCHED",
  "DELIVERED_PENDING_INSPECTION",
  "ACCEPTED",
  "RELEASE_PENDING",
  "SETTLED",
  "DISPUTED",
  "REFUND_PENDING",
  "REFUNDED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type TransactionStatusFilter = (typeof TRANSACTION_STATUSES)[number];

const transactionListQuerySchema = z.object({
  role: z.enum(["all", "seller", "buyer"]).default("all"),
  status: z.enum(TRANSACTION_STATUSES).optional(),
});

export interface TransactionListFilter {
  role: "all" | "seller" | "buyer";
  status?: TransactionStatusFilter;
}

/** Returns null when the filter is invalid (route maps to 400). */
export function parseTransactionListFilter(
  query: Record<string, string | string[] | undefined>,
): TransactionListFilter | null {
  const result = transactionListQuerySchema.safeParse({
    role: firstQueryValue(query["role"]) ?? undefined,
    status: firstQueryValue(query["status"]) ?? undefined,
  });
  return result.success ? result.data : null;
}

const publicReferenceSchema = z.string().min(1).max(128);
const inviteSlugSchema = z.string().regex(/^[0-9a-f]{32}$/);
const profileIdSchema = z.string().min(1).max(128);

/** Validated route params; null = invalid (route maps to 400/404 safely). */
export function parsePublicReference(value: string): string | null {
  const result = publicReferenceSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseInviteSlug(value: string): string | null {
  const result = inviteSlugSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseProfileId(value: string): string | null {
  const result = profileIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
