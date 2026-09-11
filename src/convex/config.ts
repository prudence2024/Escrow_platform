// Central runtime configuration. Values here are configurable business rules,
// not hard-coded product claims. Monetary values are integer minor units (kobo).

export const CURRENCY = "NGN" as const;
export type Currency = typeof CURRENCY;

// How we legally describe holding funds. Until licensed to use "escrow",
// use the safe wording below. Never claim to be a licensed escrow institution.
export const SECURED_WORDING = {
  primary: "payment secured",
  altPrimary: "protected payment",
  partnerWording: "funds secured with payment partner",
} as const;

// Fee rules (kobo). Flat/percent/cap, buyer- or seller-paid, promo zero-fee.
export const FEE_CONFIG = {
  provider: "deal-sure",
  percentageBps: 0, // basis points of transaction value, e.g. 250 = 2.50%
  flatKobo: 0,
  capKobo: Number.MAX_SAFE_INTEGER,
  chargedTo: "buyer" as "buyer" | "seller" | "split",
  promoZeroFee: true,
};

// Transaction / risk rules
export const INSPECTION_WINDOW_DAYS = 3; // configurable inspection period
export const DISPUTE_WINDOW_DAYS = 10;
export const LIMITS = {
  maxTransactionKobo: 10_000_000_00, // ₦10,000,000.00
  minTransactionKobo: 50_00, // ₦50.00
  maxTitleLength: 120,
  maxDescriptionLength: 4000,
  maxMediaPerTransaction: 12,
};

// Delivery OTP rules (configurable). TTL resolved directionally SHORT per
// Phase 2 §17: in-person handover verification must expire in minutes, not
// hours. Override via DELIVERY_OTP_TTL_SECONDS where the runtime permits;
// the default below is the development default AND the documented ceiling.
export const DELIVERY_OTP_TTL_SECONDS = 600; // 10 minutes
export const OTP = {
  ttlMs: DELIVERY_OTP_TTL_SECONDS * 1000,
  maxAttempts: 5,
  length: 6,
};

export const STATUSES = {
  DRAFT: "DRAFT",
  PENDING_BUYER_ACCEPTANCE: "PENDING_BUYER_ACCEPTANCE",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  PAYMENT_SECURED: "PAYMENT_SECURED",
  READY_FOR_DELIVERY: "READY_FOR_DELIVERY",
  DISPATCHED: "DISPATCHED",
  DELIVERED_PENDING_INSPECTION: "DELIVERED_PENDING_INSPECTION",
  ACCEPTED: "ACCEPTED",
  RELEASE_PENDING: "RELEASE_PENDING",
  SETTLED: "SETTLED",
  DISPUTED: "DISPUTED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type TransactionStatus =
  (typeof STATUSES)[keyof typeof STATUSES];

// display labels + tone used across UI
export const STATUS_LABELS: Record<TransactionStatus, string> = {
  DRAFT: "Draft",
  PENDING_BUYER_ACCEPTANCE: "Awaiting buyer acceptance",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_PROCESSING: "Payment processing",
  PAYMENT_SECURED: "Payment secured",
  READY_FOR_DELIVERY: "Ready for delivery",
  DISPATCHED: "Dispatched",
  DELIVERED_PENDING_INSPECTION: "Delivered — awaiting inspection",
  ACCEPTED: "Accepted",
  RELEASE_PENDING: "Release pending",
  SETTLED: "Settled",
  DISPUTED: "Disputed",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const ROLES = {
  USER: "user",
  SELLER: "seller",
  ADMIN: "admin",
  OPS: "ops",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const isStaff = (role?: string | null) =>
  role === ROLES.ADMIN || role === ROLES.OPS;

export const KYC_STATUS = {
  UNVERIFIED: "UNVERIFIED",
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Automotive",
  "Services",
  "Agriculture",
  "Food & Groceries",
  "Creative",
  "Other",
] as const;

// provider identifiers for payments
export const PROVIDER = {
  mock: "mock",
  paystack: "paystack", // adapter location reserved for licensed partner
  flutterwave: "flutterwave", // adapter location reserved for licensed partner
} as const;

export function feeFor(
  amountKobo: number,
): { feeKobo: number; chargedTo: "buyer" | "seller" | "split" } {
  if (FEE_CONFIG.promoZeroFee) return { feeKobo: 0, chargedTo: FEE_CONFIG.chargedTo };
  const pct = Math.round((amountKobo * FEE_CONFIG.percentageBps) / 10000);
  const total = pct + FEE_CONFIG.flatKobo;
  const feeKobo = Math.min(total, FEE_CONFIG.capKobo);
  return { feeKobo, chargedTo: FEE_CONFIG.chargedTo };
}