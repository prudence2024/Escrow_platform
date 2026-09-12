import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { STATUSES } from "./config";
import { requireStaff, performTransition, audit, notify, postDoubleEntry, genPublicId, now } from "./lib";
import { requireNonGuestUser, requireStepUp } from "./authz";
import { checkRateLimit } from "./rateLimits";
import { getProvider } from "./payments/providers";
import type { MutationCtx } from "./_generated/server";

async function txByRef(ctx: MutationCtx, reference: string) {
  const byPublic = await ctx.db.query("transactions").withIndex("by_publicId", (q) => q.eq("publicId", reference)).first();
  if (byPublic) return byPublic;
  return ctx.db.query("transactions").withIndex("by_slug", (q) => q.eq("slug", reference)).first();
}

/**
 * Compute how many kobo can still be refunded on a transaction.
 *   remainingRefundable = totalKobo − Σ(paid refunds) − Σ(paid settlements)
 *
 * This prevents over-refunding when:
 *  • multiple disputes each request a refund
 *  • a refund is requested after partial/full settlement
 */
export async function remainingRefundable(ctx: MutationCtx, txId: string, totalKobo: number): Promise<number> {
  // Sum all PAID refunds for this transaction
  const paidRefunds = await ctx.db
    .query("refunds")
    .withIndex("by_transaction", (q) => q.eq("transactionId", txId as any))
    .filter((q) => q.eq(q.field("status"), "PAID"))
    .collect();
  const totalRefunded = paidRefunds.reduce((sum, r) => sum + r.amountKobo, 0);

  // Sum all PAID settlements for this transaction
  const paidSettlements = await ctx.db
    .query("settlements")
    .withIndex("by_transaction", (q) => q.eq("transactionId", txId as any))
    .filter((q) => q.eq(q.field("status"), "PAID"))
    .collect();
  const totalSettled = paidSettlements.reduce((sum, s) => sum + s.amountKobo, 0);

  return Math.max(0, totalKobo - totalRefunded - totalSettled);
}

/** Buyer opens a dispute: blocks settlement, moves the transaction to DISPUTED. */
export const open = mutation({
  args: { reference: v.string(), reason: v.string(), details: v.optional(v.string()) },
  handler: async (ctx, { reference, reason, details }) => {
    const { user } = await requireNonGuestUser(ctx);
    await checkRateLimit(ctx, "disputeOpenPerUser", String(user._id));
    const tx = await txByRef(ctx, reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.buyerId !== user._id && tx.sellerId !== user._id) {
      throw new Error("You don't participate in this transaction");
    }
    if (tx.status === STATUSES.SETTLED || tx.status === STATUSES.REFUNDED || tx.status === STATUSES.CANCELLED) {
      throw new Error("This transaction can no longer be disputed");
    }
    const openDispute = await ctx.db
      .query("disputes")
      .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (openDispute) throw new Error("A dispute is already open for this transaction");
    if (!(await canOpenForStatus(ctx, tx.status))) {
      throw new Error(`A dispute cannot be opened in the state ${tx.status}`);
    }

    const disputeId = await ctx.db.insert("disputes", {
      transactionId: tx._id,
      openedBy: user._id,
      reason,
      details,
      status: "OPEN",
      createdAt: now(),
    });
    // settlement is blocked: move to DISPUTED (even if RELEASE_PENDING).
    if (tx.status !== STATUSES.DISPUTED) {
      await performTransition(ctx, {
        transactionDoc: tx,
        to: STATUSES.DISPUTED,
        actorId: user._id,
        reason: `Dispute opened: ${reason}`,
      });
    }
    await audit(ctx, { entityType: "dispute", entityId: disputeId, actorId: user._id, action: "DISPUTE_OPENED", from: tx.status, to: STATUSES.DISPUTED, reason });
    await notify(ctx, { userId: tx.sellerId, type: "DISPUTE", title: "A dispute was opened", body: `Dispute: ${reason}`, transactionId: tx._id });
    return { disputeId };
  },
});

async function canOpenForStatus(ctx: MutationCtx, status: string) {
  void ctx;
  return [
    STATUSES.PAYMENT_SECURED,
    STATUSES.READY_FOR_DELIVERY,
    STATUSES.DISPATCHED,
    STATUSES.DELIVERED_PENDING_INSPECTION,
    STATUSES.ACCEPTED,
    STATUSES.RELEASE_PENDING,
  ].includes(status as any);
}

export const message = mutation({
  args: { disputeId: v.id("disputes"), body: v.string() },
  handler: async (ctx, { disputeId, body }) => {
    const { user } = await requireNonGuestUser(ctx);
    await checkRateLimit(ctx, "disputeMessagePerUser", String(user._id));
    const dispute = await ctx.db.get(disputeId);
    if (!dispute) throw new Error("Dispute not found");
    const tx = await ctx.db.get(dispute.transactionId);
    const isStaff = user.role === "admin" || user.role === "ops";
    const participant = tx?.sellerId === user._id || tx?.buyerId === user._id;
    if (!isStaff && !participant) throw new Error("No access to this dispute");
    if (!body.trim()) throw new Error("Message cannot be empty");
    const msgId = await ctx.db.insert("dispute_messages", { disputeId, authorId: user._id, body: body.trim(), createdAt: now() });
    const other = tx?.sellerId === user._id ? tx?.buyerId : tx?.sellerId;
    if (other && tx) {
      await notify(ctx, { userId: other, type: "DISPUTE", title: "New message in dispute", body: body.trim().slice(0, 140), transactionId: tx._id });
    }
    return { messageId: msgId };
  },
});

export const addEvidence = mutation({
  args: { disputeId: v.id("disputes"), url: v.string() },
  handler: async (ctx, { disputeId, url }) => {
    const { user } = await requireNonGuestUser(ctx);
    const dispute = await ctx.db.get(disputeId);
    if (!dispute) throw new Error("Dispute not found");
    const tx = await ctx.db.get(dispute.transactionId);
    const isStaff = user.role === "admin" || user.role === "ops";
    const participant = tx?.sellerId === user._id || tx?.buyerId === user._id;
    if (!isStaff && !participant) throw new Error("No access");
    // MIME/size validation happens on the upload path (TODO partner scan).
    const evId = await ctx.db.insert("dispute_evidence", { disputeId, uploaderId: user._id, url, createdAt: now() });
    await audit(ctx, { entityType: "dispute", entityId: disputeId, actorId: user._id, action: "EVIDENCE_ADDED" });
    return { evidenceId: evId };
  },
});

/** Admin/ops resolution. Seller settlement or buyer refund (full or partial). */
export const resolveDispute = mutation({
  args: {
    disputeId: v.id("disputes"),
    decision: v.union(v.literal("seller_settlement"), v.literal("buyer_refund"), v.literal("partial_refund")),
    refundKobo: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { disputeId, decision, refundKobo, note }) => {
    const staff = await requireStaff(ctx);
    const dispute = await ctx.db.get(disputeId);
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status !== "OPEN") throw new Error("Dispute is not open");
    const tx = await ctx.db.get(dispute.transactionId);
    if (!tx) throw new Error("Transaction not found");

    if (dispute.transactionId !== tx._id) throw new Error("Mismatch");
    const txStatusAtRead = tx.status;
    await ctx.db.patch(disputeId, {
      status: "RESOLVED",
      resolution: decision,
      resolutionNote: note,
      resolvedBy: staff._id,
      resolvedAt: now(),
    });

    if (decision === "seller_settlement") {
      // release to seller — re-read transaction to ensure freshness after dispute patch
      const freshTx = await ctx.db.get(tx._id);
      if (!freshTx) throw new Error("Transaction not found");
      if (freshTx.status !== txStatusAtRead) {
        if (freshTx.status === STATUSES.SETTLED) return { decision, outcome: STATUSES.SETTLED };
        if (freshTx.status === STATUSES.REFUNDED) return { decision, outcome: STATUSES.REFUNDED };
        throw new Error(`Transaction status changed during dispute resolution`);
      }
      await performTransition(ctx, { transactionDoc: tx, to: STATUSES.RELEASE_PENDING, actorId: staff._id, reason: "Admin resolved in favor of seller" });
      await ctx.db.patch(tx._id, { disputeBlocked: false });
      const { releaseTx } = await import("./settlement");
      const res = await releaseTx(ctx, { publicId: tx.publicId, actorId: staff._id });
      await audit(ctx, { entityType: "dispute", entityId: disputeId, actorId: staff._id, action: "DISPUTE_RESOLVED", to: "seller_settlement", reason: note });
      return { decision, outcome: res.status };
    }

    // buyer refund (full or partial)
    // CAS freshness check before financial mutation
    const txBeforeRefund = await ctx.db.get(tx._id);
    if (!txBeforeRefund) throw new Error("Transaction not found");
    if (txBeforeRefund.status !== txStatusAtRead) {
      if (txBeforeRefund.status === STATUSES.SETTLED) return { decision, outcome: STATUSES.SETTLED };
      if (txBeforeRefund.status === STATUSES.REFUNDED) return { decision, outcome: STATUSES.REFUNDED };
      throw new Error(`Transaction status changed during dispute resolution`);
    }

    const refundAmount = decision === "partial_refund" ? (refundKobo ?? 0) : tx.totalKobo;
    if (refundAmount <= 0) throw new Error("Refund amount must be positive");

    // Refund cap: remainingRefundable = totalKobo − already_refunded − already_settled
    const cap = await remainingRefundable(ctx, tx._id, tx.totalKobo);
    if (refundAmount > cap) {
      throw new Error(`Refund amount ${refundAmount} exceeds remaining refundable ${cap} (already refunded: ${tx.totalKobo - cap})`);
    }
    // Privileged financial approval: step-up MFA gate (Decision F). Dev:
    // audit-logged bypass. Production without MFA: denied.
    await requireStepUp(ctx, "refund.approve", String(disputeId), String(staff._id));
    await performTransition(ctx, { transactionDoc: tx, to: STATUSES.REFUND_PENDING, actorId: staff._id, reason: "Admin resolved in favor of buyer" });
    const intent = await ctx.db.query("payment_intents").withIndex("by_transaction", (q) => q.eq("transactionId", tx._id)).filter((q) => q.eq(q.field("status"), "SECURED")).first();
    const provider = getProvider(intent?.provider ?? "mock");
    const result = await provider.requestRefund({ reference: genPublicId("ref"), amountKobo: refundAmount, currency: tx.currency });
    const refundId = await ctx.db.insert("refunds", {
      transactionId: tx._id,
      payerId: tx.buyerId ?? (dispute.openedBy as any),
      provider: intent?.provider ?? "mock",
      providerRef: result.providerRef,
      amountKobo: refundAmount,
      reason: note ?? "Admin decision",
      status: result.status,
      createdAt: now(),
      completedAt: result.status === "PAID" ? now() : undefined,
    });
    if (result.status === "PAID") {
      await postDoubleEntry(ctx, {
        refId: genPublicId("led"),
        transactionId: tx._id,
        memo: `Refund to buyer (${decision})`,
        debit: { code: "2000", amountKobo: refundAmount },
        credit: { code: "1000", amountKobo: refundAmount },
      });
      await performTransition(ctx, { transactionDoc: { ...tx, status: STATUSES.REFUND_PENDING }, to: STATUSES.REFUNDED, actorId: staff._id, reason: "Refund completed" });
    }
    await notify(ctx, { userId: tx.buyerId ?? undefined, type: "REFUND", title: "Refund processed", body: `Refund of ${refundAmount.toLocaleString()} kobo on "${tx.title}".`, transactionId: tx._id });
    await notify(ctx, { userId: tx.sellerId, type: "DISPUTE", title: "Dispute resolved", body: `Dispute decided: ${decision}`, transactionId: tx._id });
    await audit(ctx, { entityType: "dispute", entityId: disputeId, actorId: staff._id, action: "DISPUTE_RESOLVED", to: decision, reason: note });
    return { decision, refundId, status: result.status };
  },
});