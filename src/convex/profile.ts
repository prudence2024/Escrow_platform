import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireAdmin, audit } from "./lib";

export const getOwnProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx as any);
    const [profile, kyc, bank] = await Promise.all([
      ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", user._id)).first(),
      ctx.db.query("kyc_profiles").withIndex("by_user", (q) => q.eq("userId", user._id)).first(),
      ctx.db.query("bank_accounts").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
    ]);
    return { profile, kyc, bank, user };
  },
});

export const updateProfile = mutation({
  args: { fullName: v.optional(v.string()), phone: v.optional(v.string()), country: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", user._id)).first();
    const patch: any = { ...args, onboarded: true };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("profiles", { userId: user._id, ...args, onboarded: true });
    }
    if (args.fullName) await ctx.db.patch(user._id, { name: args.fullName, onboarded: true });
    return { ok: true };
  },
});

export const addBankAccount = mutation({
  args: { accountName: v.string(), accountNumber: v.string(), bankName: v.string(), isDefault: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!/^[0-9]{10}$/.test(args.accountNumber)) throw new Error("Invalid account number");
    const dup = await ctx.db.query("bank_accounts").withIndex("by_accountNumber", (q) => q.eq("accountNumber", args.accountNumber)).first();
    if (dup) throw new Error("This account is already registered");
    await ctx.db.insert("bank_accounts", { userId: user._id, accountName: args.accountName, accountNumber: args.accountNumber, bankName: args.bankName, status: "PENDING", isDefault: args.isDefault ?? true });
    await audit(ctx, { entityType: "bank_account", entityId: user._id, actorId: user._id, action: "BANK_ADDED" });
    return { ok: true };
  },
});

export const submitKyc = mutation({
  args: { docType: v.string() },
  handler: async (ctx, { docType }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.query("kyc_profiles").withIndex("by_user", (q) => q.eq("userId", user._id)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { docType, status: "SUBMITTED" });
    } else {
      await ctx.db.insert("kyc_profiles", { userId: user._id, docType, status: "SUBMITTED" });
    }
    await ctx.db.patch(user._id, { kycStatus: "SUBMITTED" });
    await audit(ctx, { entityType: "kyc", entityId: user._id, actorId: user._id, action: "KYC_SUBMITTED" });
    return { ok: true };
  },
});

/** Admin only: set another user's role. */
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("seller"), v.literal("ops"), v.literal("admin")) },
  handler: async (ctx, { userId, role }) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(userId, { role });
    await audit(ctx, { entityType: "user", entityId: userId, actorId: admin._id, action: "ROLE_CHANGED", to: role });
    return { ok: true };
  },
});