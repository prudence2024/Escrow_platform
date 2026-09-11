import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { STATUSES, SECURED_WORDING, PROVIDER } from "./config";
import { performTransition, audit, notify, postDoubleEntry, genPublicId, now } from "./lib";
import { requireNonGuestUser } from "./authz";
import { getProvider } from "./payments/providers";
import type { MutationCtx } from "./_generated/server";

async function getTxByReference(ctx: MutationCtx, reference: string) {
  const byPublic = await ctx.db.query("transactions").withIndex("by_publicId", (q) => q.eq("publicId", reference)).first();
  if (byPublic) return byPublic;
  return ctx.db.query("transactions").withIndex("by_slug", (q) => q.eq("slug", reference)).first();
}

/** Initiate payment. AWAITING_PAYMENT -> PAYMENT_PROCESSING. */
export const requestPayment = mutation({
  args: {
    reference: v.string(),
    idempotencyKey: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, { reference, idempotencyKey, provider = "mock" }) => {
    const { user } = await requireNonGuestUser(ctx);
    const tx = await getTxByReference(ctx, reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.buyerId !== user._id) throw new Error("Only the buyer can initiate payment");

    // idempotency: if this key already produced an intent, return it
    const existing = await ctx.db
      .query("payment_intents")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .filter((q) => q.eq(q.field("transactionId"), tx._id))
      .first();
    if (existing) {
      return {
        paymentIntentId: existing._id,
        status: existing.status,
        wording: SECURED_WORDING.altPrimary,
        alreadyProcessed: existing.status !== "PENDING",
      };
    }

    if (tx.status !== STATUSES.AWAITING_PAYMENT) {
      throw new Error("Transaction is not in a payable state");
    }
    const providerAPI = getProvider(provider);
    const refId = genPublicId("pay");
    const init = await providerAPI.initializePayment({
      reference: refId,
      amountKobo: tx.totalKobo,
      currency: tx.currency,
      payerEmail: user.email,
    });
    const intentId = await ctx.db.insert("payment_intents", {
      transactionId: tx._id,
      payerId: user._id,
      provider,
      providerIntentId: init.providerIntentId,
      idempotencyKey,
      amountKobo: tx.totalKobo,
      currency: tx.currency,
      status: "PENDING",
      createdAt: now(),
    });
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.PAYMENT_PROCESSING,
      actorId: user._id,
      reason: "Payment initiated",
    });
    void intentId;
    return {
      paymentIntentId: intentId,
      status: "PENDING",
      redirectUrl: init.redirectUrl,
      wording: SECURED_WORDING.altPrimary,
    };
  },
});

/**
 * Buyer-facing completion of the (mock) provider checkout. This invokes the
 * provider's handleWebhook (server-side verification) which is the only thing
 * that may move PAYMENT_PROCESSING -> PAYMENT_SECURED. A replay with the same
 * idempotencyKey is safe and returns the already-verified result.
 */
export const confirmPayment = mutation({
  args: { reference: v.string(), idempotencyKey: v.string() },
  handler: async (ctx, { reference, idempotencyKey }) => {
    // NOTE (Phase 11): this mock confirmation path is buyer-triggered by
    // design for sandbox only. A live provider MUST replace it with a
    // provider-signed webhook; never carry this pattern to live money.
    const { user } = await requireNonGuestUser(ctx);
    const tx = await getTxByReference(ctx, reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.buyerId !== user._id) throw new Error("Only the buyer can confirm this payment");

    if (tx.status === STATUSES.PAYMENT_SECURED) {
      // already secured -> idempotent success
      return { status: STATUSES.PAYMENT_SECURED, wording: SECURED_WORDING.primary, alreadyProcessed: true };
    }
    if (tx.status !== STATUSES.PAYMENT_PROCESSING) {
      throw new Error("No payment in progress for this transaction");
    }

    const intent = await ctx.db
      .query("payment_intents")
      .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
      .order("desc")
      .first();
    if (!intent) throw new Error("Payment intent not found");
    if (intent.status === "SECURED") {
      return { status: STATUSES.PAYMENT_SECURED, wording: SECURED_WORDING.primary, alreadyProcessed: true };
    }

    const providerAPI = getProvider(intent.provider);
    // Simulate the provider's event id; stored on first receipt, reused on replay.
    const eventId = intent.providerEventId ?? `${intent.provider}_evt_${now()}_${intent._id}`;
    if (!intent.providerEventId) {
      await ctx.db.patch(intent._id, { providerEventId: eventId });
    }
    const result = await providerAPI.handleWebhook({
      providerIntentId: intent.providerIntentId!,
      events: "payment_success",
      providerEventId: eventId,
      raw: { amountKobo: tx.totalKobo },
    });
    if (result.status !== "SECURED" || result.capturedAmountKobo !== tx.totalKobo) {
      throw new Error("Provider did not confirm payment (amount mismatch)");
    }

    // record raw event metadata
    await ctx.db.insert("payment_events", {
      paymentIntentId: intent._id,
      providerEventId: eventId,
      type: "payment_success",
      raw: JSON.stringify({ amountKobo: tx.totalKobo }),
      receivedAt: now(),
    });
    await ctx.db.patch(intent._id, { status: "SECURED", securedAt: now() });

    // ledger: custody asset increases, buyer payable liability increases
    await postDoubleEntry(ctx, {
      refId: genPublicId("led"),
      transactionId: tx._id,
      memo: "Funds secured with payment partner",
      debit: { code: "1000", amountKobo: tx.totalKobo },
      credit: { code: "2000", amountKobo: tx.totalKobo },
    });

    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.PAYMENT_SECURED,
      actorId: user._id,
      reason: "Payment verified via provider webhook",
    });
    await notify(ctx, {
      userId: tx.sellerId,
      type: "PAYMENT_SECURED",
      title: "Payment secured",
      body: `Payment for "${tx.title}" has been verified. You can now deliver.`,
      transactionId: tx._id,
    });
    await audit(ctx, { entityType: "payment_intent", entityId: intent._id, actorId: user._id, action: "PAYMENT_VERIFIED", to: "SECURED", meta: JSON.stringify({ amountKobo: tx.totalKobo, provider: intent.provider }) });
    return { status: STATUSES.PAYMENT_SECURED, wording: SECURED_WORDING.primary, alreadyProcessed: false };
  },
});

export const listProviders = mutation({
  args: {},
  handler: async () => [PROVIDER.mock],
});