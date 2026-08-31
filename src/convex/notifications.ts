import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib";

export const myNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const user = await requireUser(ctx as any);
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx as any);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .take(100);
    return rows.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const user = await requireUser(ctx);
    const n = await ctx.db.get(notificationId);
    if (!n || n.userId !== user._id) throw new Error("Notification not found");
    await ctx.db.patch(notificationId, { readAt: Date.now() });
    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .take(200);
    await Promise.all(
      rows.map((r) => ctx.db.patch(r._id, { readAt: Date.now() })),
    );
    return { ok: true };
  },
});