import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { STATUSES, OTP as OTPCFG, INSPECTION_WINDOW_DAYS } from "./config";
import { performTransition, audit, notify, now } from "./lib";
import { requireNonGuestUser } from "./authz";
import { checkRateLimit } from "./rateLimits";
import {
  digestOtp,
  digestsEqual,
  generateSecureNumericCode,
  normalizeOtpInput,
} from "../lib/otp";

function otpSecret(): string {
  // Server-only secret. Fail closed: no code is ever issued or verified
  // without it. Set DELIVERY_OTP_HASH_SECRET in the Convex environment.
  const secret = process.env.DELIVERY_OTP_HASH_SECRET;
  if (!secret) throw new Error("Delivery OTP is not configured");
  return secret;
}

/** Dev-only one-time reveal of a generated code (sandbox UI convenience). */
function devRevealEnabled(): boolean {
  return process.env.DELIVERY_OTP_DEV_REVEAL === "true";
}

/**
 * OTP lifetime: centralized default (config.OTP.ttlMs), overridable via
 * DELIVERY_OTP_TTL_SECONDS. Clamped to a 1-hour ceiling — anything longer
 * needs a security review, never silent hours-long validity.
 */
function otpTtlMs(): number {
  const raw = process.env.DELIVERY_OTP_TTL_SECONDS;
  if (raw == null || raw === "") return OTPCFG.ttlMs;
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 60) return OTPCFG.ttlMs;
  return Math.min(seconds, 3600) * 1000;
}

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
    const { user } = await requireNonGuestUser(ctx);
    const tx = await txByRef(ctx, args.reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.sellerId !== user._id) throw new Error("Only the seller can dispatch");
    if (tx.status !== STATUSES.PAYMENT_SECURED && tx.status !== STATUSES.READY_FOR_DELIVERY) {
      throw new Error("Payment must be secured before dispatch");
    }
    // Bound OTP re-issuance per transaction (closes regeneration floods).
    await checkRateLimit(ctx, "dispatchPerTx", String(tx._id));

    const deliveryId = await ctx.db.insert("deliveries", {
      transactionId: tx._id,
      courierName: args.courierName,
      trackingNumber: args.trackingNumber,
      carrierDetails: args.carrierDetails,
      dispatchedAt: now(),
      status: "DISPATCHED",
    });
    const code = generateSecureNumericCode(OTPCFG.length);
    const expiresAt = now() + otpTtlMs();
    // Single live code per transaction: supersede any prior unconsumed codes.
    const stale = await ctx.db
      .query("delivery_otps")
      .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
      .collect();
    for (const row of stale) {
      if (row.consumedAt == null) await ctx.db.patch(row._id, { consumedAt: now() });
    }
    const secret = otpSecret();
    await ctx.db.insert("delivery_otps", {
      transactionId: tx._id,
      deliveryId,
      codeDigest: digestOtp({
        secret,
        context: `${String(tx._id)}:${String(deliveryId)}`,
        otp: code,
      }),
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
    // The plaintext code is returned at most ONCE and only when the explicit
    // dev-reveal flag is set. Otherwise the caller receives null and the code
    // travels exclusively through the buyer's verified channel. Never logged.
    return {
      status: STATUSES.DISPATCHED,
      deliveryOtp: devRevealEnabled() ? code : null,
      deliveryId,
    };
  },
});

export const confirmDelivery = mutation({
  args: { reference: v.string(), otp: v.string() },
  handler: async (ctx, { reference, otp }) => {
    const { user } = await requireNonGuestUser(ctx);
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
    if (!otpDoc || !otpDoc.codeDigest) throw new Error("No delivery code issued");
    if (otpDoc.consumedAt) throw new Error("Delivery code already used");
    if (now() > otpDoc.expiresAt) throw new Error("Delivery code has expired");
    if (otpDoc.attempts >= OTPCFG.maxAttempts) throw new Error("Too many attempts — contact support");
    const candidate = digestOtp({
      secret: otpSecret(),
      context: `${String(tx._id)}:${String(otpDoc.deliveryId)}`,
      otp: normalizeOtpInput(otp),
    });
    if (!digestsEqual(otpDoc.codeDigest, candidate)) {
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