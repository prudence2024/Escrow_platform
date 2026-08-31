import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { STATUSES, OTP as OTPCFG, INSPECTION_WINDOW_DAYS } from "./config";
import { requireUser, performTransition, audit, notify, genCode, now } from "./lib";

async function txByRef(ctx: MutationCtx, reference: string) {
  const byPublic = await ctx.db.query("transactions").withIndex("by_publicId", (q) => q.eq("publicId", reference)).first();
  if (byPublic) return byPublic;
  return ctx.db.query("transactions").withIndex("by_slug", (q) => q.eq("slug", reference)).first();
}

/** Seller dispatches the order. Generates a one-time delivery OTP. */
export const dispatch = mutation({
  args: {
    reference: v.string(),
    courierName: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    carrierDetails: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tx = await txByRef(ctx, args.reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.sellerId !== user._id) throw new Error("Only the seller can dispatch");
    if (tx.status !== STATUSES.PAYMENT_SECURED && tx.status !== STATUSES.READY_FOR_DELIVERY) {
      throw new Error("Payment must be secured before dispatch");
    }

    const deliveryId = await ctx.db.insert("deliveries", {
      transactionId: tx._id,
      courierName: args.courierName,
      trackingNumber: args.trackingNumber,
      carrierDetails: args.carrierDetails,
      dispatchedAt: now(),
      status: "DISPATCHED",
    });
    const code = genCode(OTPCFG.length);
    const expiresAt = now() + OTPCFG.ttlMs;
    await ctx.db.insert("delivery_otps", {
      transactionId: tx._id,
      deliveryId,
      codeHash: code, // dev: stored readable; production would hash (TODO)
      expiresAt,
      attempts: 0,
    });

    await ctx.db.insert("delivery_events", {
      deliveryId,
      type: "DISPATCHED",
      actorId: user._id,
      at: now(),
      note: `Dispatched via ${args.courierName ?? "unknown"}`,
    });
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.DISPATCHED,
      actorId: user._id,
      reason: "Dispatched by seller",
    });
    await notify(ctx, {
      userId: tx.buyerId ?? undefined,
      type: "DISPATCHED",
      title: "Your item is on its way",
      body: `"${tx.title}" has been dispatched. You'll confirm delivery with a one-time code.`,
      transactionId: tx._id,
    });
    await audit(ctx, { entityType: "transaction", entityId: tx._id, actorId: user._id, action: "DISPATCH", to: STATUSES.DISPATCHED });
    // Return the OTP to the seller (mock/dev convenience: share with buyer).
    return { status: STATUSES.DISPATCHED, deliveryOtp: code, deliveryId };
  },
});

export const confirmDelivery = mutation({
  args: { reference: v.string(), otp: v.string() },
  handler: async (ctx, { reference, otp }) => {
    const user = await requireUser(ctx);
    const tx = await txByRef(ctx, reference);
    if (!tx) throw new Error("Transaction not found");
    // buyer (or participant) confirms receipt using OTP
    if (tx.buyerId !== user._id) throw new Error("Only the buyer can confirm delivery");
    if (tx.status !== STATUSES.DISPATCHED) throw new Error("Transaction is not awaiting delivery confirmation");

    const otpDoc = await ctx.db
      .query("delivery_otps")
      .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
      .order("desc")
      .first();
    if (!otpDoc) throw new Error("No delivery code issued");
    if (otpDoc.consumedAt) throw new Error("Delivery code already used");
    if (now() > otpDoc.expiresAt) throw new Error("Delivery code has expired");
    if (otpDoc.attempts >= OTPCFG.maxAttempts) throw new Error("Too many attempts — contact support");
    if (otpDoc.codeHash !== otp.trim()) {
      await ctx.db.patch(otpDoc._id, { attempts: otpDoc.attempts + 1 });
      throw new Error("Incorrect delivery code");
    }

    const inspectionDeadlineAt = now() + (tx.inspectionWindowDays ?? INSPECTION_WINDOW_DAYS) * 24 * 60 * 60 * 1000;
    await ctx.db.patch(otpDoc._id, { consumedAt: now(), attempts: otpDoc.attempts + 1 });
    const deliveryDoc = await ctx.db
      .query("deliveries")
      .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
      .order("desc")
      .first();
    if (deliveryDoc) {
      await ctx.db.patch(deliveryDoc._id, { deliveredAt: now(), inspectionDeadlineAt, status: "DELIVERED" });
      await ctx.db.insert("delivery_events", { deliveryId: deliveryDoc._id, type: "DELIVERED", actorId: user._id, at: now(), note: "Buyer confirmed delivery" });
    }
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.DELIVERED_PENDING_INSPECTION,
      actorId: user._id,
      reason: "Delivery confirmed by buyer",
    });
    await notify(ctx, {
      userId: tx.sellerId,
      type: "DELIVERED",
      title: "Delivery confirmed",
      body: "The buyer confirmed receipt. Settlement will follow the inspection window / acceptance.",
      transactionId: tx._id,
    });
    await audit(ctx, { entityType: "transaction", entityId: tx._id, actorId: user._id, action: "DELIVERED", to: STATUSES.DELIVERED_PENDING_INSPECTION });
    return { status: STATUSES.DELIVERED_PENDING_INSPECTION, inspectionDeadlineAt };
  },
});