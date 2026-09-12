import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  CURRENCY,
  LIMITS,
  CATEGORIES,
  STATUSES,
  STATUS_LABELS,
  feeFor,
  INSPECTION_WINDOW_DAYS,
} from "./config";
import {
  requireStaff,
  genPublicId,
  genSlug,
  performTransition,
  audit,
  notify,
  now,
} from "./lib";
import { canOpenDispute, isTerminal } from "./transactions/state";
import { getActor } from "./lib";
import { requireNonGuestUser } from "./authz";
import { checkRateLimit } from "./rateLimits";

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

async function getTxByPublicIdOrSlug(ctx: any, publicId: string) {
  const q = ctx.db.query("transactions") as any;
  const byPublic = await q.withIndex("by_publicId", (qq: any) => qq.eq("publicId", publicId)).first();
  if (byPublic) return byPublic;
  const bySlug = await ctx.db
    .query("transactions")
    .withIndex("by_slug", (qq: any) => qq.eq("slug", publicId))
    .first();
  return bySlug;
}

async function participant(ctx: any, transactionId: string, userId: string) {
  return ctx.db
    .query("transaction_participants")
    .withIndex("by_transaction", (q: any) => q.eq("transactionId", transactionId))
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .first();
}

async function canViewTransaction(ctx: any, tx: any, user: any) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "ops") return true;
  if (tx.sellerId === user._id) return true;
  if (tx.buyerId === user._id) return true;
  if (await participant(ctx, tx._id, user._id)) return true;
  // Pre-acceptance invite: a buyer reviewing terms over the unguessable link
  // may view (but not act financially) until they accept.
  if (tx.status === STATUSES.PENDING_BUYER_ACCEPTANCE && tx.sellerId !== user._id) {
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// queries
// --------------------------------------------------------------------------

export const myTransactions = query({
  args: { limit: v.optional(v.number()), status: v.optional(v.string()) },
  handler: async (ctx, { limit = 50, status }) => {
    const user = await getActor(ctx);
    if (!user) return [];
    const asSeller = await ctx.db
      .query("transactions")
      .withIndex("by_seller", (q) => q.eq("sellerId", user._id))
      .order("desc")
      .take(limit);
    const asBuyer = await ctx.db
      .query("transactions")
      .withIndex("by_buyer", (q) => q.eq("buyerId", user._id))
      .order("desc")
      .take(limit);
    const viaParts = await ctx.db
      .query("transaction_participants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(limit);
    const fromParts: any[] = [];
    for (const p of viaParts) {
      const t = await ctx.db.get(p.transactionId);
      if (t) fromParts.push(t);
    }
    const seen = new Map<string, any>();
    for (const t of [...asSeller, ...asBuyer, ...fromParts]) {
      if (status && t.status !== status) continue;
      if (!seen.has(t._id)) seen.set(t._id, t);
    }
    return [...seen.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
});

export const detail = query({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const tx = await getTxByPublicIdOrSlug(ctx, publicId);
    if (!tx) throw new Error("Transaction not found");
    const actor = await getActor(ctx);
    if (!(await canViewTransaction(ctx, tx, actor))) {
      throw new Error("You don't have access to this transaction");
    }
    const [items, media, history, parts, payments, deliveries, disputes, settlements, refunds, seller, buyer] =
      await Promise.all([
        ctx.db
          .query("transaction_items")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .collect(),
        ctx.db
          .query("transaction_media")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .collect(),
        ctx.db
          .query("transaction_status_history")
          .withIndex("by_transaction_desc", (q) => q.eq("transactionId", tx._id))
          .order("desc")
          .take(100),
        ctx.db
          .query("transaction_participants")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .collect(),
        ctx.db
          .query("payment_intents")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .order("desc")
          .take(20),
        ctx.db
          .query("deliveries")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .collect(),
        ctx.db
          .query("disputes")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .order("desc")
          .take(10),
        ctx.db
          .query("settlements")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .collect(),
        ctx.db
          .query("refunds")
          .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
          .collect(),
        tx.sellerId ? ctx.db.get(tx.sellerId) : null,
        tx.buyerId ? ctx.db.get(tx.buyerId) : null,
      ]);

    return {
      ...tx,
      statusLabel: STATUS_LABELS[tx.status as keyof typeof STATUS_LABELS],
      seller: seller
        ? { name: (seller as any).name ?? "Seller", email: (seller as any).email }
        : null,
      buyer: buyer ? { name: (buyer as any).name ?? "Buyer", email: (buyer as any).email } : null,
      items,
      media,
      history,
      participants: parts,
      payments,
      deliveries,
      disputes,
      settlements,
      refunds,
      // client permission flags (server still enforces; these aid UI)
      permissions: {
        isSeller: actor ? tx.sellerId === actor._id : false,
        isParticipant: actor
          ? !!(await participant(ctx, tx._id, actor._id))
          : false,
        isStaff: actor ? actor.role === "admin" || actor.role === "ops" : false,
        canAct: actor
          ? (await canViewTransaction(ctx, tx, actor)) && !isTerminal(tx.status as any)
          : false,
        canOpenDispute: actor ? canOpenDispute(tx.status as any) : false,
      },
    };
  },
});

export const list = query({
  // admin/staff listing
  args: { status: v.optional(v.string()), q: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { status, q, limit = 50 }) => {
    await requireStaff(ctx as any);
    let rows = await ctx.db
      .query("transactions")
      .order("desc")
      .take(300);
    if (status) rows = rows.filter((t) => t.status === status);
    if (q) {
      const tq = q.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(tq) ||
          t.publicId.toLowerCase().includes(tq),
      );
    }
    return rows.slice(0, limit);
  },
});

// --------------------------------------------------------------------------
// mutations
// --------------------------------------------------------------------------

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    condition: v.optional(v.string()),
    amountKobo: v.number(),
    deliveryFeeKobo: v.number(),
    agreedDeadlineAt: v.optional(v.number()),
    inspectionWindowDays: v.optional(v.number()),
    returnTerms: v.optional(v.string()),
    buyerEmail: v.optional(v.string()),
    items: v.optional(v.array(v.object({ name: v.string(), note: v.optional(v.string()) }))),
    mediaUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Guests (sandbox/demo) may not create consequential transactions.
    const { user } = await requireNonGuestUser(ctx);
    await checkRateLimit(ctx, "txCreatePerUser", String(user._id));
    if (args.title.trim().length < 3) throw new Error("Title is too short");
    if (args.title.length > LIMITS.maxTitleLength) throw new Error("Title is too long");
    if (args.description.length > LIMITS.maxDescriptionLength) throw new Error("Description is too long");
    if (!CATEGORIES.includes(args.category as any)) throw new Error("Invalid category");
    if (args.amountKobo > LIMITS.maxTransactionKobo) throw new Error("Amount exceeds limit");
    if (args.amountKobo < LIMITS.minTransactionKobo) throw new Error("Amount below minimum");
    if (args.deliveryFeeKobo < 0) throw new Error("Delivery fee must be non-negative");
    const totalKobo = args.amountKobo + args.deliveryFeeKobo;
    const { feeKobo, chargedTo } = feeFor(args.amountKobo);
    if ((args.mediaUrls?.length ?? 0) > LIMITS.maxMediaPerTransaction) {
      throw new Error("Too many media items");
    }

    const publicId = genPublicId("dex");
    const slug = genSlug();
    const createdAt = now();
    const txId = await ctx.db.insert("transactions", {
      publicId,
      slug,
      status: STATUSES.DRAFT,
      sellerId: user._id,
      buyerEmail: args.buyerEmail,
      title: args.title.trim(),
      description: args.description.trim(),
      category: args.category,
      condition: args.condition,
      amountKobo: args.amountKobo,
      deliveryFeeKobo: args.deliveryFeeKobo,
      totalKobo,
      feeKobo,
      feeChargedTo: chargedTo,
      currency: CURRENCY,
      agreedDeadlineAt: args.agreedDeadlineAt ?? undefined,
      inspectionWindowDays: args.inspectionWindowDays ?? INSPECTION_WINDOW_DAYS,
      returnTerms: args.returnTerms,
      createdAt,
      updatedAt: createdAt,
    });

    for (const it of args.items ?? []) {
      await ctx.db.insert("transaction_items", { transactionId: txId, name: it.name, note: it.note });
    }
    for (const url of args.mediaUrls ?? []) {
      await ctx.db.insert("transaction_media", { transactionId: txId, url, kind: "image" });
    }
    await ctx.db.insert("transaction_status_history", {
      transactionId: txId,
      actorId: user._id,
      fromStatus: undefined,
      toStatus: STATUSES.DRAFT,
      reason: "Created",
      at: createdAt,
    });
    await audit(ctx, { entityType: "transaction", entityId: txId, actorId: user._id, action: "CREATE", to: STATUSES.DRAFT });
    return { publicId };
  },
});

export const publish = mutation({
  // seller publishes -> shareable link. DRAFT -> PENDING_BUYER_ACCEPTANCE
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const { user } = await requireNonGuestUser(ctx);
    const tx = await getTxByPublicIdOrSlug(ctx as any, publicId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.sellerId !== user._id) throw new Error("Only the seller can publish");
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.PENDING_BUYER_ACCEPTANCE,
      actorId: user._id,
      reason: "Published by seller",
    });
    if (tx.buyerEmail) {
      const buyerUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", tx.buyerEmail))
        .first();
      if (buyerUser) {
        await notify(ctx, {
          userId: buyerUser._id,
          type: "TRANSACTION_INVITE",
          title: "You have a protected payment to review",
          body: `A seller shared "${tx.title}" with you. Review and accept to pay securely.`,
          transactionId: tx._id,
        });
      }
    }
    return { slug: tx.slug, publicId: tx.publicId };
  },
});

export const acceptTerms = mutation({
  // Buyer accepts terms -> AWAITING_PAYMENT
  args: { reference: v.string() }, // publicId or slug
  handler: async (ctx, { reference }) => {
    const { user } = await requireNonGuestUser(ctx);
    await checkRateLimit(ctx, "acceptPerUser", String(user._id));
    const tx = await getTxByPublicIdOrSlug(ctx as any, reference);
    if (!tx) throw new Error("Transaction not found");
    if (tx.sellerId === user._id) throw new Error("Sellers can't accept their own transaction");
    if (tx.status !== STATUSES.PENDING_BUYER_ACCEPTANCE) {
      throw new Error("Transaction is not awaiting buyer acceptance");
    }
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.AWAITING_PAYMENT,
      actorId: user._id,
      reason: "Buyer accepted terms",
      extra: { buyerId: user._id },
    });
    const existing = await participant(ctx as any, tx._id, user._id);
    if (!existing) {
      await ctx.db.insert("transaction_participants", {
        transactionId: tx._id,
        userId: user._id,
        role: "buyer",
        email: user.email,
        acceptedAt: now(),
      });
    }
    // terms acceptance record
    await ctx.db.insert("terms_acceptances", {
      userId: user._id,
      version: 1,
      acceptedAt: now(),
    });
    await notify(ctx, {
      userId: tx.sellerId,
      type: "BUYER_ACCEPTED",
      title: "Buyer accepted your terms",
      body: `${user.name ?? "A buyer"} accepted terms for "${tx.title}".`,
      transactionId: tx._id,
    });
    return { status: STATUSES.AWAITING_PAYMENT };
  },
});

export const cancel = mutation({
  args: { publicId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { publicId, reason }) => {
    const { user } = await requireNonGuestUser(ctx);
    const tx = await getTxByPublicIdOrSlug(ctx as any, publicId);
    if (!tx) throw new Error("Transaction not found");
    const isSeller = tx.sellerId === user._id;
    const isBuyer = !!(await participant(ctx as any, tx._id, user._id));
    if (!isSeller && !isBuyer && user.role !== "admin" && user.role !== "ops") {
      throw new Error("You don't have access");
    }
    if (isTerminal(tx.status as any)) throw new Error("Transaction already finalized");
    if (tx.status === STATUSES.PAYMENT_PROCESSING) {
      throw new Error("Payment in progress — cannot cancel; void it from ops if needed");
    }
    if (tx.status === STATUSES.PAYMENT_SECURED) {
      throw new Error("Payment already secured — use the dispute/refund flow to reverse");
    }
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.CANCELLED,
      actorId: user._id,
      reason: reason ?? "Cancelled",
    });
    await audit(ctx, { entityType: "transaction", entityId: tx._id, actorId: user._id, action: "CANCEL", reason, to: STATUSES.CANCELLED });
    return { status: STATUSES.CANCELLED };
  },
});

/** Expire overdue transactions (admin/ops or cron). */
export const expireOverdue = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const user = await requireStaff(ctx);
    const tx = await getTxByPublicIdOrSlug(ctx as any, publicId);
    if (!tx) throw new Error("Transaction not found");
    const EXPIRABLE = new Set([STATUSES.PENDING_BUYER_ACCEPTANCE, STATUSES.AWAITING_PAYMENT]);
    if (!EXPIRABLE.has(tx.status as any)) {
      throw new Error(`Transaction in status ${tx.status} cannot be expired`);
    }
    if (isTerminal(tx.status as any)) throw new Error("Transaction already finalized");
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.EXPIRED,
      actorId: user._id,
      reason: "Transaction expired",
    });
    await audit(ctx, { entityType: "transaction", entityId: tx._id, actorId: user._id, action: "EXPIRE", reason: "Overdue", to: STATUSES.EXPIRED });
    return { status: STATUSES.EXPIRED };
  },
});

export const freeze = mutation({
  args: { publicId: v.string(), reason: v.string() },
  handler: async (ctx, { publicId, reason }) => {
    const user = await requireStaff(ctx);
    const tx = await getTxByPublicIdOrSlug(ctx as any, publicId);
    if (!tx) throw new Error("Transaction not found");
    if (!reason.trim()) throw new Error("Freeze reason required");
    await ctx.db.patch(tx._id, { disputeBlocked: true, updatedAt: now() });
    await ctx.db.insert("risk_flags", {
      transactionId: tx._id,
      flaggedBy: user._id,
      reason,
      severity: "HIGH",
      status: "OPEN",
      createdAt: now(),
    });
    await audit(ctx, { entityType: "transaction", entityId: tx._id, actorId: user._id, action: "FREEZE", reason, meta: "risk_flag" });
    return { ok: true };
  },
});

export const markReady = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const { user } = await requireNonGuestUser(ctx);
    const tx = await getTxByPublicIdOrSlug(ctx as any, publicId);
    if (!tx || tx.sellerId !== user._id) throw new Error("Only the seller can mark ready");
    await performTransition(ctx, {
      transactionDoc: tx,
      to: STATUSES.READY_FOR_DELIVERY,
      actorId: user._id,
      reason: "Seller ready to ship",
    });
    await notify(ctx, { userId: tx.buyerId ?? undefined, type: "READY", title: "Seller is ready to deliver", transactionId: tx._id });
    return { status: STATUSES.READY_FOR_DELIVERY };
  },
});

// internal: trigger release & settlement when release conditions met
export const settle = mutation({
  args: { publicId: v.string(), idempotencyKey: v.optional(v.string()) },
  handler: async (ctx, { publicId, idempotencyKey }) => {
    // called by buyer accept / admin decision. release conditions enforced in releaseTx.
    const { user } = await requireNonGuestUser(ctx);
    const { releaseTx } = await import("./settlement");
    return releaseTx(ctx, { publicId, actorId: user._id, idempotencyKey });
  },
});
