/**
 * Public API response contracts (Phase 4, §12).
 * DTOs are the ONLY shape clients see — never raw database rows. Internal
 * UUIDs, contact details, financial internals, and staff-only fields are
 * excluded unless the specific DTO explicitly allows them.
 */

export interface PaginationDto {
  limit: number;
  offset: number;
  total: number;
}

export interface TransactionSummaryDto {
  publicReference: string;
  title: string;
  category: string;
  currency: string;
  amountMinor: number;
  totalMinor: number;
  status: string;
  /** Viewer relationship: seller | buyer | participant | staff. */
  viewerRole: "seller" | "buyer" | "participant" | "staff";
  updatedAt: number;
}

export interface TransactionDetailDto extends TransactionSummaryDto {
  description: string;
  deliveryFeeMinor: number;
  platformFeeMinor: number;
  inspectionDeadline: number | null;
  counterpartyDisplayName: string | null;
  createdAt: number;
}

/**
 * Minimum safe pre-acceptance preview for the high-entropy invite slug.
 * NO buyer info, NO contact details, NO internal UUIDs, NO financial
 * internals, NO staff fields.
 */
export interface InviteTransactionDto {
  title: string;
  description: string;
  category: string;
  currency: string;
  amountMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  status: string;
  inspectionWindowDays: number | null;
  returnTerms: string | null;
  sellerDisplayName: string | null;
}

/** Own private profile (authenticated owner only). */
export interface ProfileDto {
  id: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

/** Public seller/merchant card: display identity only. */
export interface PublicSellerDto {
  profileId: string;
  displayName: string | null;
}

export interface HealthDto {
  status: "ok";
}

export interface ReadinessDto {
  ready: boolean;
  migrations: { applied: number; expected: number };
}
