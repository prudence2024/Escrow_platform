import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./lib";

export const searchUsers = query({
  args: { q: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { q, limit = 25 }) => {
    await requireStaff(ctx as any);
    const users = await ctx.db.query("users").take(500);
    if (!q) return users.slice(0, limit);
    const t = q.toLowerCase();
    return users
      .filter((u) => u.email?.toLowerCase().includes(t) || u.name?.toLowerCase().includes(t))
      .slice(0, limit);
  },
});

export const listDisputes = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { status, limit = 50 }) => {
    await requireStaff(ctx as any);
    let rows = await ctx.db.query("disputes").order("desc").take(200);
    if (status) rows = rows.filter((d) => d.status === status);
    return rows.slice(0, limit);
  },
});

export const disputeDetail = query({
  args: { disputeId: v.id("disputes") },
  handler: async (ctx, { disputeId }) => {
    await requireStaff(ctx as any);
    const dispute = await ctx.db.get(disputeId);
    if (!dispute) throw new Error("Dispute not found");
    const tx = dispute.transactionId ? await ctx.db.get(dispute.transactionId) : null;
    const [messages, evidence] = await Promise.all([
      ctx.db.query("dispute_messages").withIndex("by_dispute", (q) => q.eq("disputeId", disputeId)).order("asc").take(200),
      ctx.db.query("dispute_evidence").withIndex("by_dispute", (q) => q.eq("disputeId", disputeId)).order("asc").take(100),
    ]);
    return { dispute, transaction: tx, messages, evidence };
  },
});

export const auditLog = query({
  args: { limit: v.optional(v.number()), entityType: v.optional(v.string()), entityId: v.optional(v.string()) },
  handler: async (ctx, { limit = 100, entityType, entityId }) => {
    await requireStaff(ctx as any);
    let rows: any[] = [];
    if (entityType && entityId) {
      rows = await ctx.db.query("audit_logs").withIndex("by_entity", (q) => q.eq("entityType", entityType).eq("entityId", entityId)).order("desc").take(limit);
    } else {
      rows = await ctx.db.query("audit_logs").withIndex("by_at", (q) => q).order("desc").take(limit);
    }
    return rows;
  },
});

export const listPayments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    await requireStaff(ctx as any);
    return ctx.db.query("payment_intents").withIndex("by_payer", (q) => q).order("desc").take(limit);
  },
});

export const addAdminNote = mutation({
  args: { transactionId: v.id("transactions"), body: v.string() },
  handler: async (ctx, { transactionId, body }) => {
    const staff = await requireStaff(ctx);
    if (!body.trim()) throw new Error("Note cannot be empty");
    await ctx.db.insert("admin_notes", { transactionId, authorId: staff._id, body: body.trim(), createdAt: Date.now() });
    return { ok: true };
  },
});