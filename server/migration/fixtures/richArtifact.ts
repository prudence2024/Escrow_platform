/**
 * Rich synthetic Convex-shaped artifact generator (Phase 6, §16–§17, §28).
 *
 * Fixture-only producer: deterministic synthetic data covering the full
 * lifecycle (all 16 canonical states) plus relationship depth (items,
 * participants, fees, payment retry FAILED→SECURED, delivery events,
 * OPEN + RESOLVED disputes, PENDING + PAID refunds/settlements, roles,
 * terms, notifications). No real PII — fixed dev.test identities.
 *
 * Purpose: feed the repeatable parity rehearsal (artifact → import →
 * snapshots → compare). Doubles as the documented answer to "how would a
 * development Convex export be produced" without touching any deployment.
 */
import type { ConvexExportArtifact } from "../snapshots.js";

const AT = 1780000000000;

interface Row {
  [key: string]: string | number | null;
}

function slug(suffix: string): string {
  const base = `f${suffix}`.padEnd(32, "0");
  return base.slice(0, 32).replace(/[^0-9a-f]/g, "a");
}

export function buildRichConvexArtifact(): ConvexExportArtifact {
  const users: Row[] = [
    { _id: "jx-seller", email: "seller@dev.test", name: "Rita Seller", role: "seller" },
    { _id: "jx-buyer", email: "buyer@dev.test", name: "Bola Buyer", role: "user" },
    { _id: "jx-buyer2", email: "buyer2@dev.test", name: "Tunde Buyer", role: "user" },
    { _id: "jx-admin", email: "admin@dev.test", name: "Ada Admin", role: "admin" },
    { _id: "jx-ops", email: "ops@dev.test", name: "Seun Ops", role: "ops" },
    { _id: "jx-weird", email: "weird@dev.test", name: "Weird Role", role: "root" },
  ];

  const states: Array<[string, string, string, number, number, number]> = [
    // id-suffix, status, title, amountKobo, deliveryFeeKobo, feeKobo
    ["draft", "DRAFT", "Draft camera", 2000000, 100000, 0],
    ["pending", "PENDING_BUYER_ACCEPTANCE", "Pending laptop", 3500000, 150000, 50000],
    ["awaiting", "AWAITING_PAYMENT", "Awaiting console", 1500000, 100000, 0],
    ["processing", "PAYMENT_PROCESSING", "Processing bike", 800000, 50000, 0],
    ["secured", "PAYMENT_SECURED", "Secured watch", 1200000, 100000, 20000],
    ["ready", "READY_FOR_DELIVERY", "Ready chair", 500000, 50000, 0],
    ["dispatched", "DISPATCHED", "Dispatched phone", 2500000, 100000, 30000],
    ["delivered", "DELIVERED_PENDING_INSPECTION", "Delivered tablet", 1800000, 100000, 0],
    ["accepted", "ACCEPTED", "Accepted speaker", 900000, 50000, 0],
    ["release", "RELEASE_PENDING", "Releasing mixer", 700000, 50000, 10000],
    ["settled", "SETTLED", "Settled fridge", 5000000, 200000, 100000],
    ["disputed", "DISPUTED", "Disputed generator", 4000000, 150000, 0],
    ["refundpending", "REFUND_PENDING", "Refund-pending dryer", 1100000, 100000, 0],
    ["refunded", "REFUNDED", "Refunded oven", 1300000, 100000, 0],
    ["cancelled", "CANCELLED", "Cancelled lamp", 300000, 0, 0],
    ["expired", "EXPIRED", "Expired invite", 600000, 50000, 0],
  ];

  const transactions: Row[] = [];
  const participants: Row[] = [];
  const items: Row[] = [];
  const intents: Row[] = [];
  const deliveries: Row[] = [];
  const disputes: Row[] = [];
  const disputeMessages: Row[] = [];
  const evidence: Row[] = [];
  const settlements: Row[] = [];
  const refunds: Row[] = [];

  const needsBuyer = new Set([
    "awaiting", "processing", "secured", "ready", "dispatched", "delivered",
    "accepted", "release", "settled", "disputed", "refundpending", "refunded",
  ]);

  for (const [suffix, status, title, amount, fee, platform] of states) {
    const txId = `jx-tx-${suffix}`;
    const total = amount + fee + platform;
    transactions.push({
      _id: txId,
      publicId: `dex_rich_${suffix}`,
      slug: slug(suffix),
      sellerId: "jx-seller",
      buyerId: needsBuyer.has(suffix) ? "jx-buyer" : null,
      title,
      description: `${title} (rich synthetic fixture)`,
      category: "Electronics",
      amountKobo: amount,
      deliveryFeeKobo: fee,
      feeKobo: platform,
      totalKobo: total,
      currency: "NGN",
      status,
    });
    if (needsBuyer.has(suffix)) {
      participants.push({ _id: `jx-part-${suffix}`, transactionId: txId, userId: "jx-buyer", role: "buyer" });
    }
    items.push({ _id: `jx-item-${suffix}-a`, transactionId: txId, name: `${title} unit`, quantity: suffix === "settled" ? 2 : 1 });
    if (suffix === "settled") {
      items.push({ _id: `jx-item-${suffix}-b`, transactionId: txId, name: `${title} accessory`, quantity: 3 });
    }
  }

  // Payment retry parity: FAILED attempt preserved, SECURED attempt current.
  // Explicit createdAt ordering decides "latest" identically on both sides.
  intents.push(
    { _id: "jx-pi-retry-failed", transactionId: "jx-tx-secured", payerId: "jx-buyer", provider: "mock", amountKobo: 1320000, status: "FAILED", idempotencyKey: "retry-a", createdAt: AT + 1 },
    { _id: "jx-pi-retry-ok", transactionId: "jx-tx-secured", payerId: "jx-buyer", provider: "mock", amountKobo: 1320000, status: "SECURED", idempotencyKey: "retry-b", createdAt: AT + 2 },
  );
  for (const suffix of ["processing", "dispatched", "delivered", "accepted", "release", "settled", "disputed", "refundpending", "refunded"]) {
    const tx = states.find(([s]) => s === suffix);
    if (tx === undefined) continue;
    const total = tx[3] + tx[4] + tx[5];
    intents.push({
      _id: `jx-pi-${suffix}`, transactionId: `jx-tx-${suffix}`, payerId: "jx-buyer",
      provider: "mock", amountKobo: total, status: "SECURED", idempotencyKey: `seed-${suffix}`,
    });
  }

  deliveries.push(
    { _id: "jx-del-1", transactionId: "jx-tx-dispatched", status: "DISPATCHED", courierName: "Rich Courier" },
    { _id: "jx-del-2", transactionId: "jx-tx-delivered", status: "DELIVERED" },
  );

  disputes.push(
    { _id: "jx-disp-open", transactionId: "jx-tx-disputed", openedBy: "jx-buyer", reason: "not_as_described", details: "Wrong color", status: "OPEN" },
    { _id: "jx-disp-resolved", transactionId: "jx-tx-refunded", openedBy: "jx-buyer", reason: "damaged", details: "Cracked", status: "RESOLVED", resolution: "buyer_refund", resolvedBy: "jx-admin" },
  );
  disputeMessages.push(
    { _id: "jx-dmsg-1", disputeId: "jx-disp-open", authorId: "jx-buyer", body: "Item differs from photos" },
    { _id: "jx-dmsg-2", disputeId: "jx-disp-open", authorId: "jx-admin", body: "Evidence requested" },
  );
  evidence.push(
    { _id: "jx-dev-1", disputeId: "jx-disp-open", uploaderId: "jx-buyer", storageKey: "rich/unbox-1.jpg", mimeType: "image/jpeg", sizeBytes: 44500 },
  );

  settlements.push(
    { _id: "jx-stl-pending", transactionId: "jx-tx-release", payeeId: "jx-seller", amountKobo: 760000, status: "PENDING", provider: "mock" },
    { _id: "jx-stl-paid", transactionId: "jx-tx-settled", payeeId: "jx-seller", amountKobo: 5300000, status: "PAID", provider: "mock", providerRef: "mock_rich_settle_1" },
  );

  refunds.push(
    { _id: "jx-ref-pending", transactionId: "jx-tx-refundpending", amountKobo: 1200000, requestedBy: "jx-buyer", status: "PENDING", provider: "mock" },
    { _id: "jx-ref-paid", transactionId: "jx-tx-refunded", amountKobo: 1400000, requestedBy: "jx-buyer", status: "PAID", provider: "mock", providerRef: "mock_rich_refund_1" },
  );

  return {
    exportedAt: AT,
    source: "rich-synthetic-fixture",
    collections: {
      users,
      transactions,
      transaction_participants: participants,
      transaction_items: items,
      payment_intents: intents,
      deliveries,
      disputes,
      dispute_messages: disputeMessages,
      dispute_evidence: evidence,
      settlements,
      refunds,
      terms_versions: [{ _id: "jx-terms-v1", version: 1, content: "Rich fixture terms", effectiveAt: AT }],
      terms_acceptances: [
        { _id: "jx-ta-1", userId: "jx-buyer", termsVersionId: "jx-terms-v1", transactionId: "jx-tx-awaiting" },
      ],
      notifications: [
        { _id: "jx-n-1", userId: "jx-seller", type: "PAYMENT_SECURED", title: "Rich: payment secured" },
      ],
      audit_logs: [
        { _id: "jx-a-1", action: "FIXTURE", entityType: "database", entityId: "rich-v1" },
      ],
    },
  };
}
