import { QueryCtx, MutationCtx } from "./_generated/server";
import { TransactionStatus } from "./config";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaff } from "./config";
import {
  ALLOWED_TRANSITIONS,
  StateTransitionError,
} from "./transactions/state";

export async function getActor(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get(userId) : null;
}

export async function requireUser(ctx: MutationCtx) {
  const user = await getActor(ctx);
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function requireStaff(ctx: MutationCtx) {
  const user = await requireUser(ctx);
  if (!isStaff(user.role ?? null)) throw new Error("Insufficient permissions");
  return user;
}

export async function requireAdmin(ctx: MutationCtx) {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new Error("Admin permissions required");
  return user;
}

// ---- ids / slugs ---------------------------------------------------------

function randHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  let s = "";
  for (const b of arr) s += b.toString(16).padStart(2, "0");
  return s;
}

export function genPublicId(prefix: string): string {
  const time = Date.now().toString(36);
  return `${prefix}_${time}${randHex(8)}`;
}

export function genSlug(): string {
  return randHex(12); // unguessable share-link token
}

export function genCode(length: number): string {
  const digits = "0123456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += digits[Math.floor(Math.random() * digits.length)];
  }
  return s;
}

export const now = () => Date.now();

// ---- audit ----

export async function audit(
  ctx: MutationCtx,
  args: {
    entityType: string;
    entityId: string;
    actorId?: string | null;
    action: string;
    from?: string | null;
    to?: string | null;
    reason?: string | null;
    meta?: string | null;
  },
) {
  await ctx.db.insert("audit_logs", {
    entityType: args.entityType,
    entityId: args.entityId,
    actorId: args.actorId ? (args.actorId as any) : undefined,
    action: args.action,
    from: args.from ?? undefined,
    to: args.to ?? undefined,
    reason: args.reason ?? undefined,
    meta: args.meta ?? undefined,
    at: now(),
  });
}

// ---- notifications ----

export async function notify(
  ctx: MutationCtx,
  args: {
    userId?: string | null;
    type: string;
    title: string;
    body?: string;
    transactionId?: string;
  },
) {
  if (!args.userId) return;
  await ctx.db.insert("notifications", {
    userId: args.userId as any,
    type: args.type,
    title: args.title,
    body: args.body,
    transactionId: args.transactionId as any,
    createdAt: now(),
  });
  // Abstraction stub for email/SMS/web-push channels.
}

// ---- ledger (double-entry, append-only) ----

async function ensureLedgerAccount(ctx: MutationCtx, code: string, type: string) {
  const existing = await ctx.db
    .query("ledger_accounts")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("ledger_accounts", {
    code,
    name: code,
    type,
    currency: "NGN",
  });
}

export async function postDoubleEntry(
  ctx: MutationCtx,
  args: {
    refId: string;
    transactionId?: string;
    memo: string;
    debit: { code: string; amountKobo: number };
    credit: { code: string; amountKobo: number };
  },
) {
  const { debit, credit } = args;
  if (debit.amountKobo !== credit.amountKobo) {
    throw new Error("Double-entry imbalance: debits must equal credits");
  }
  const debitAccount = await ensureLedgerAccount(ctx, debit.code, "ASSET");
  const creditAccount = await ensureLedgerAccount(ctx, credit.code, "LIABILITY");
  const txId = args.transactionId ? (args.transactionId as any) : undefined;
  await ctx.db.insert("ledger_entries", {
    accountId: debitAccount,
    transactionId: txId,
    entryRefId: args.refId,
    debitKobo: debit.amountKobo,
    creditKobo: 0,
    memo: `${args.memo} [debit]`,
    createdAt: now(),
  });
  await ctx.db.insert("ledger_entries", {
    accountId: creditAccount,
    transactionId: txId,
    entryRefId: args.refId,
    debitKobo: 0,
    creditKobo: credit.amountKobo,
    memo: `${args.memo} [credit]`,
    createdAt: now(),
  });
}

// ---- status transition helper for transactions ----

export async function performTransition(
  ctx: MutationCtx,
  args: {
    transactionDoc: { _id: any; status: string };
    to: string;
    actorId?: string | null;
    reason?: string;
    extra?: Record<string, unknown>;
  },
) {
  const from = args.transactionDoc.status as TransactionStatus;
  const to = args.to as TransactionStatus;
  if (!ALLOWED_TRANSITIONS[from]?.has(to)) {
    throw new StateTransitionError(from, to);
  }
  await ctx.db.patch(args.transactionDoc._id, {
    status: to,
    ...(args.extra as any),
    updatedAt: now(),
  });
  await ctx.db.insert("transaction_status_history", {
    transactionId: args.transactionDoc._id as any,
    actorId: args.actorId ? (args.actorId as any) : undefined,
    fromStatus: from,
    toStatus: to,
    reason: args.reason,
    at: now(),
  });
  await audit(ctx, {
    entityType: "transaction",
    entityId: args.transactionDoc._id,
    actorId: args.actorId,
    action: "STATUS_CHANGE",
    from,
    to,
    reason: args.reason,
  });
  return from;
}