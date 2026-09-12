import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { STATUSES, feeFor } from "./config";
import { performTransition, audit, notify, postDoubleEntry, genPublicId, now } from "./lib";
import { requireNonGuestUser } from "./authz";
import { getProvider } from "./payments/providers";
import type { MutationCtx } from "./_generated/server";

async function txByRef(ctx: MutationCtx, reference: string) {
  const byPublic = await ctx.db.query("transactions").withIndex("by_publicId", (q) => q.eq("publicId", reference)).first();
  if (byPublic) return byPublic;
  return ctx.db.query("transactions").withIndex("by_slug", (q) => q.eq("slug", reference)).first();
}

/**
 * Release conditions, enforced server-side, never by a client timer:
 *  - payment must have been verified (a SECURED intent exists)
 *  - the transaction must be ACCEPTED or RELEASE_PENDING
 *  - no OPEN dispute may exist
 *  - transaction must not be settlement-blocked
 * If met, moves to RELEASE_PENDING then SETTLED through the provider abstraction.
 */
export async function releaseTx(ctx: MutationCtx, args: { publicId: string; actorId: string; idempotencyKey?: string }) {
  const tx = await txByRef(ctx, args.publicId);
  if (!tx) throw new Error("Transaction not found");
  if (tx.disputeBlocked) throw new Error("Transaction is settlement-blocked (frozen)");

  // Idempotent: if already settled, return success without re-processing.
  // Convex per-document serialization prevents concurrent settlement of the same tx.
  if (tx.status === STATUSES.SETTLED) {
    return { status: STATUSES.SETTLED, alreadyProcessed: true };
  }
  if (tx.status !== STATUSES.ACCEPTED && tx.status !== STATUSES.RELEASE_PENDING) {
    throw new Error(`Transaction is not eligible for settlement (${tx.status})`);
  }

  const statusAtRead = tx.status;

  // settlement-blocked while an OPEN dispute exists
  const openDispute = await ctx.db
    .query("disputes")
    .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
    .filter((q) => q.eq(q.field("status"), "OPEN"))
    .first();
  if (openDispute) throw new Error("Settlement blocked by an open dispute");

  // CAS freshness check: re-read transaction to ensure no concurrent mutation
  // changed it between our initial read and the dispute check (cross-document race).
  const freshTx = await ctx.db.get(tx._id);
  if (!freshTx) throw new Error("Transaction not found");
  if (freshTx.status !== statusAtRead) {
    // Status changed — another mutation raced us. If now SETTLED, return idempotent.
    if (freshTx.status === STATUSES.SETTLED) return { status: STATUSES.SETTLED, alreadyProcessed: true };
    throw new Error(`Transaction status changed during settlement (was ${statusAtRead}, now ${freshTx.status})`);
  }

  // payment must have been server-verified
  const securedIntent = await ctx.db
    .query("payment_intents")
    .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
    .filter((q) => q.eq(q.field("status"), "SECURED"))
    .first();
  if (!securedIntent) throw new Error("Payment has not been verified");

  // Fee-aware settlement: seller receives totalKobo − feeKobo
  const { feeKobo } = feeFor(tx.totalKobo);
  const sellerSettlementKobo = Math.max(0, tx.totalKobo - feeKobo);

  if (tx.status === STATUSES.ACCEPTED) {
    await performTransition(ctx, { transactionDoc: tx, to: STATUSES.RELEASE_PENDING, actorId: args.actorId, reason: "Release conditions met" });
  }

  const bank = await ctx.db
    .query("bank_accounts")
    .withIndex("by_user", (q) => q.eq("userId", tx.sellerId))
    .order("desc")
    .first();
  const provider = getProvider(securedIntent.provider);
  const refId = genPublicId("stl");
  const settlementResult = await provider.requestSettlement({
    reference: refId,
    recipientAccountNumber: bank?.accountNumber ?? "0000000000",
    recipientBankCode: bank?.bankCode ?? "",
    amountKobo: sellerSettlementKobo,
    currency: tx.currency,
  });
  const settlementId = await ctx.db.insert("settlements", {
    transactionId: tx._id,
    recipientId: tx.sellerId,
    provider: securedIntent.provider,
    providerRef: settlementResult.providerRef,
    amountKobo: sellerSettlementKobo,
    status: settlementResult.status,
    createdAt: now(),
    completedAt: settlementResult.status === "PAID" ? now() : undefined,
  });

  if (settlementResult.status === "PAID") {
    // release funds out of custody: buyer payable decreases, custody asset decreases
    await postDoubleEntry(ctx, {
      refId: genPublicId("led"),
      transactionId: tx._id,
      memo: "Settlement released to seller",
      debit: { code: "2000", amountKobo: sellerSettlementKobo },
      credit: { code: "1000", amountKobo: sellerSettlementKobo },
    });

    // Record fee revenue if non-zero
    if (feeKobo > 0) {
      await postDoubleEntry(ctx, {
        refId: genPublicId("led"),
        transactionId: tx._id,
        memo: "Platform fee revenue",
        debit: { code: "2000", amountKobo: feeKobo },
        credit: { code: "4000", amountKobo: feeKobo },
      });
    }
    await performTransition(ctx, {
      transactionDoc: { ...tx, status: STATUSES.RELEASE_PENDING },
      to: STATUSES.SETTLED,
      actorId: args.actorId,
      reason: "Settlement confirmed by provider",
    });
    await audit(ctx, { entityType: "settlement", entityId: settlementId, actorId: args.actorId, action: "SETTLED", to: STATUSES.SETTLED });
  }
  await notify(ctx, { userId: tx.sellerId, type: "SETTLED", title: "Settlement complete", body: `Your funds for "${tx.title}" have been released.`, transactionId: tx._id });
  return { status: STATUSES.SETTLED, settlementId, providerRef: settlementResult.providerRef };
}

/** Buyer accepts delivery -> triggers release if no blocking condition. */
export const accept = mutation({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const { user } = await requireNonGuestUser(ctx);
    const tx = await txByRef(ctx, reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.buyerId !== user._id) throw new Error("Only the buyer can accept delivery");
    if (tx.status !== STATUSES.DELIVERED_PENDING_INSPECTION) {
      throw new Error("Only delivered items awaiting inspection can be accepted");
    }
    if (tx.disputeBlocked) throw new Error("Transaction is settlement-blocked");
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.ACCEPTED,
      actorId: user._id,
      reason: "Buyer accepted delivery",
    });
    await audit(ctx, { entityType: "transaction", entityId: tx._id, actorId: user._id, action: "ACCEPT_RESPONSIBILITY", to: STATUSES.ACCEPTED });
    const res = await releaseTx(ctx, { publicId: reference, actorId: user._id });
    return res;
  },
});