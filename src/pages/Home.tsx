import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKobo, timeAgo, STATUS_LABELS, STATUS_TONE } from "@/lib/format";
import {
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Wallet,
  Scale,
} from "lucide-react";

const ACTION_STATUSES = new Set([
  "DRAFT",
  "PENDING_BUYER_ACCEPTANCE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAYMENT_SECURED",
  "READY_FOR_DELIVERY",
  "DISPATCHED",
  "DELIVERED_PENDING_INSPECTION",
]);

export default function Home() {
  const { user } = useAuth();
  const deals = useQuery(api.transactions.myTransactions, {});
  const profile = useQuery(api.profile.getOwnProfile, {});

  const list = deals ?? [];
  const active = list.filter((t) => ACTION_STATUSES.has(t.status));
  const pendingProfile =
    !user?.role || user.role === "user";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {deals === undefined ? "Welcome" : `Hi${user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {active.length === 0
            ? "No active deals. Protect your first transaction."
            : `${active.length} active ${active.length === 1 ? "deal" : "deals"} need attention.`}
        </p>
      </div>

      {pendingProfile && (
        <Card className="border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Complete your seller profile to get paid</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add your payout details so settlement can reach you instantly.
            </p>
            <Link to="/profile" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Set up payouts <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Card>
      )}

      {/* Primary CTA row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/transactions/new">
          <div className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <PlusCircle className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Create a protected deal</p>
              <p className="text-xs text-muted-foreground">Sell with guaranteed settlement</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
        <Link to="/transactions">
          <div className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Your deals</p>
              <p className="text-xs text-muted-foreground">Track payments and deliveries</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Next actions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
          Next actions
        </h2>
        {deals === undefined ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center">
            <Scale className="mx-auto mb-3 size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Create your first protected deal to be paid safely for every sale.
            </p>
            <Button asChild size="sm" className="mt-4 gap-2">
              <Link to="/transactions/new">
                <PlusCircle className="size-4" /> Create a deal
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.slice(0, 5).map((t) => (
              <Link
                key={t._id}
                to={`/t/${t.publicId}`}
                className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{t.title}</p>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatKobo(t.totalKobo)}</span>
                    <span>·</span>
                    <span>{t.sellerId === user?._id ? "Selling" : "Buying"}</span>
                    <span>·</span>
                    <span>{timeAgo(t.createdAt)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
              </Link>
            ))}
            {active.length > 5 && (
              <Link
                to="/transactions"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all deals →
              </Link>
            )}
          </div>
        )}
      </section>

      {profile?.kyc && (
        <Card className="p-4 flex items-center gap-3 border-border/70">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">KYC {profile.kyc.status}</p>
            <p className="text-xs text-muted-foreground">
              Verification unlocks higher transaction limits.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}