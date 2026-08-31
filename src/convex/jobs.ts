import { internalMutation } from "./_generated/server";
import { STATUSES } from "./config";
import { performTransition } from "./lib";

const SYSTEM = "system";

/** Automated release is a scheduled backend decision, never a frontend timer. */
export const inspectionAutoRelease = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const overdueDeliveries = await ctx.db
      .query("deliveries")
      .withIndex("by_status", (q) => q.eq("status", "DELIVERED"))
      .collect();

    for (const d of overdueDeliveries) {
      if (!d.inspectionDeadlineAt || d.inspectionDeadlineAt > now) continue;
      const tx: any = await ctx.db.get(d.transactionId);
      if (!tx) continue;
      if (tx.status !== STATUSES.DELIVERED_PENDING_INSPECTION) continue;
      if (tx.disputeBlocked) continue;

      const openDispute = await ctx.db
        .query("disputes")
        .withIndex("by_transaction", (q) => q.eq("transactionId", tx._id))
        .filter((q) => q.eq(q.field("status"), "OPEN"))
        .first();
      if (openDispute) continue;

      // auto-accept: inspection expired without a dispute
      await performTransition(ctx, {
        transactionDoc: tx,
        to: STATUSES.ACCEPTED,
        actorId: null,
        reason: "Inspection window expired without a dispute",
      });
      const { releaseTx } = await import("./settlement");
      try {
        await releaseTx(ctx as any, { publicId: tx.publicId, actorId: SYSTEM });
      } catch (e: any) {
        // release blocked (e.g. payout details missing) — will retry next cycle
        console.error("auto-release blocked", e?.message);
      }
    }
  },
});