import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { ROLES, KYC_STATUS } from "./config";

// Shared validators used across the domain.
export const roleValidator = v.union(
  v.literal(ROLES.USER),
  v.literal(ROLES.SELLER),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.OPS),
);

export const transactionValidator = v.union(
  v.literal("DRAFT"),
  v.literal("PENDING_BUYER_ACCEPTANCE"),
  v.literal("AWAITING_PAYMENT"),
  v.literal("PAYMENT_PROCESSING"),
  v.literal("PAYMENT_SECURED"),
  v.literal("READY_FOR_DELIVERY"),
  v.literal("DISPATCHED"),
  v.literal("DELIVERED_PENDING_INSPECTION"),
  v.literal("ACCEPTED"),
  v.literal("RELEASE_PENDING"),
  v.literal("SETTLED"),
  v.literal("DISPUTED"),
  v.literal("REFUND_PENDING"),
  v.literal("REFUNDED"),
  v.literal("CANCELLED"),
  v.literal("EXPIRED"),
);

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    phone: v.optional(v.string()),
    kycStatus: v.optional(v.string()),
    onboarded: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // ----- Identity / compliance -----
  profiles: defineTable({
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    country: v.optional(v.string()),
    onboarded: v.optional(v.boolean()),
    termsVersionAccepted: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["phone"]),

  kyc_profiles: defineTable({
    userId: v.id("users"),
    status: v.optional(v.string()),
    docType: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    rejectedReason: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  bank_accounts: defineTable({
    userId: v.id("users"),
    provider: v.optional(v.string()),
    accountName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    bankCode: v.optional(v.string()),
    status: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_accountNumber", ["accountNumber"]),

  terms_versions: defineTable({
    version: v.number(),
    content: v.string(),
    effectiveAt: v.number(),
  }).index("by_version", ["version"]),

  terms_acceptances: defineTable({
    userId: v.id("users"),
    version: v.number(),
    acceptedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_version", ["userId", "version"]),

  // ----- Transactions -----
  transactions: defineTable({
    publicId: v.string(),
    slug: v.string(),
    status: transactionValidator,

    // seller
    sellerId: v.id("users"),
    buyerId: v.optional(v.id("users")),
    buyerEmail: v.optional(v.string()),
    buyerPhone: v.optional(v.string()),

    title: v.string(),
    description: v.string(),
    category: v.string(),
    condition: v.optional(v.string()),

    amountKobo: v.number(),
    deliveryFeeKobo: v.number(),
    totalKobo: v.number(),
    feeKobo: v.number(),
    feeChargedTo: v.optional(v.string()),
    currency: v.string(),

    agreedDeadlineAt: v.optional(v.number()),
    inspectionWindowDays: v.optional(v.number()),
    returnTerms: v.optional(v.string()),

    disputeBlocked: v.optional(v.boolean()),
    releasedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_publicId", ["publicId"])
    .index("by_slug", ["slug"])
    .index("by_seller", ["sellerId", "createdAt"])
    .index("by_buyer", ["buyerId", "createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_created", ["createdAt"]),

  transaction_items: defineTable({
    transactionId: v.id("transactions"),
    name: v.string(),
    note: v.optional(v.string()),
  }).index("by_transaction", ["transactionId"]),

  transaction_media: defineTable({
    transactionId: v.id("transactions"),
    storageId: v.optional(v.string()),
    url: v.optional(v.string()),
    kind: v.optional(v.string()),
  }).index("by_transaction", ["transactionId"]),

  transaction_status_history: defineTable({
    transactionId: v.id("transactions"),
    actorId: v.optional(v.id("users")),
    fromStatus: v.optional(transactionValidator),
    toStatus: transactionValidator,
    reason: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_transaction", ["transactionId", "at"])
    .index("by_transaction_desc", ["transactionId"]),

  transaction_participants: defineTable({
    transactionId: v.id("transactions"),
    userId: v.id("users"),
    role: v.string(),
    email: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_user", ["userId", "transactionId"]),

  // ----- Payments -----
  payment_intents: defineTable({
    transactionId: v.id("transactions"),
    payerId: v.id("users"),
    provider: v.string(),
    providerIntentId: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    idempotencyKey: v.string(),
    amountKobo: v.number(),
    currency: v.string(),
    status: v.string(), // PENDING | SECURED | REFUNDED | FAILED | CANCELLED
    rawEvent: v.optional(v.string()),
    createdAt: v.number(),
    securedAt: v.optional(v.number()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_providerEventId", ["providerEventId"])
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_payer", ["payerId", "createdAt"]),

  payment_events: defineTable({
    paymentIntentId: v.id("payment_intents"),
    providerEventId: v.string(),
    type: v.string(),
    raw: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index("by_intent", ["paymentIntentId", "receivedAt"])
    .index("by_providerEventId", ["providerEventId"]),

  // ----- Ledger (double-entry, append-only) -----
  ledger_accounts: defineTable({
    code: v.string(),
    name: v.string(),
    type: v.string(), // ASSET | LIABILITY | REVENUE | EXPENSE | EQUITY
    currency: v.string(),
  }).index("by_code", ["code"]),

  ledger_entries: defineTable({
    accountId: v.id("ledger_accounts"),
    transactionId: v.optional(v.id("transactions")),
    entryRefId: v.string(),
    debitKobo: v.number(),
    creditKobo: v.number(),
    memo: v.string(),
    reversalOfEntryId: v.optional(v.id("ledger_entries")),
    createdAt: v.number(),
  })
    .index("by_account", ["accountId", "createdAt"])
    .index("by_transaction", ["transactionId"])
    .index("by_ref", ["entryRefId"]),

  // ----- Delivery -----
  deliveries: defineTable({
    transactionId: v.id("transactions"),
    courierName: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    carrierDetails: v.optional(v.string()),
    dispatchedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    inspectionDeadlineAt: v.optional(v.number()),
    status: v.optional(v.string()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_status", ["status", "inspectionDeadlineAt"]),

  delivery_events: defineTable({
    deliveryId: v.id("deliveries"),
    type: v.string(),
    actorId: v.optional(v.id("users")),
    at: v.number(),
    note: v.optional(v.string()),
  }).index("by_delivery", ["deliveryId", "at"]),

  delivery_otps: defineTable({
    transactionId: v.id("transactions"),
    deliveryId: v.id("deliveries"),
    // HMAC-SHA256 hex digest (server secret + per-record context). Plaintext
    // OTP is NEVER stored. Legacy dev rows holding plaintext fail closed.
    codeDigest: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_delivery", ["deliveryId"]),

  // Persistent server-side rate-limit buckets (Phase 2).
  rate_limit_counters: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  // ----- Disputes -----
  disputes: defineTable({
    transactionId: v.id("transactions"),
    openedBy: v.id("users"),
    reason: v.string(),
    details: v.optional(v.string()),
    status: v.string(), // OPEN | RESOLVED | REFUNDED | CLOSED
    resolution: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_transaction", ["transactionId", "createdAt"])
    .index("by_openedBy", ["openedBy", "createdAt"])
    .index("by_status", ["status", "createdAt"]),

  dispute_messages: defineTable({
    disputeId: v.id("disputes"),
    authorId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_dispute", ["disputeId", "createdAt"]),

  dispute_evidence: defineTable({
    disputeId: v.id("disputes"),
    uploaderId: v.id("users"),
    url: v.optional(v.string()),
    storageId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_dispute", ["disputeId", "createdAt"]),

  // ----- Settlement / refunds -----
  settlements: defineTable({
    transactionId: v.id("transactions"),
    recipientId: v.id("users"),
    provider: v.string(),
    providerRef: v.optional(v.string()),
    amountKobo: v.number(),
    status: v.optional(v.string()), // PENDING | PAID | FAILED
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_recipient", ["recipientId", "createdAt"]),

  refunds: defineTable({
    transactionId: v.id("transactions"),
    payerId: v.id("users"),
    provider: v.string(),
    providerRef: v.optional(v.string()),
    amountKobo: v.number(),
    reason: v.optional(v.string()),
    status: v.optional(v.string()), // PENDING | PAID | FAILED
    idempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_payer", ["payerId", "createdAt"]),

  // ----- Notifications -----
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    transactionId: v.optional(v.id("transactions")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_unread", ["userId", "readAt", "createdAt"]),

  // ----- Audit / ops -----
  audit_logs: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    actorId: v.optional(v.id("users")),
    action: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    reason: v.optional(v.string()),
    meta: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_entity", ["entityType", "entityId", "at"])
    .index("by_actor", ["actorId", "at"])
    .index("by_action", ["action", "at"])
    .index("by_at", ["at"]),

  risk_flags: defineTable({
    transactionId: v.optional(v.id("transactions")),
    userId: v.optional(v.id("users")),
    flaggedBy: v.optional(v.id("users")),
    reason: v.string(),
    severity: v.string(), // LOW | MEDIUM | HIGH
    status: v.string(), // OPEN | REVIEWED | CLEARED
    createdAt: v.number(),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_user", ["userId"]),

  admin_notes: defineTable({
    transactionId: v.optional(v.id("transactions")),
    authorId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_transaction", ["transactionId", "createdAt"])
    .index("by_author", ["authorId", "createdAt"]),
});
export default schema;