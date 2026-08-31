import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatKobo, timeAgo, STATUS_LABELS, STATUS_TONE } from "@/lib/format";
import { ArrowLeftRight, PlusCircle, Store, UserRound } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "DRAFT", label: "Drafts" },
  { key: "SETTLED", label: "Settled" },
  { key: "DISPUTED", label: "Disputed" },
] as const;

export default function Transactions() {
  const [filter, setFilter] = useState<string>("all");
  const deals = useQuery(api.transactions.myTransactions, {});
  const list = deals ?? [];

  const filtered = list.filter((t) => {
    if (filter === "all") return true;
    if (filter === "active")
      return !["SETTLED", "REFUNDED", "CANCELLED", "EXPIRED"].includes(t.status);
    return t.status === filter;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">Your protected transactions</p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/transactions/new">
            <PlusCircle className="size-4" /> <span className="hidden sm:inline">New</span>
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {deals === undefined ? (
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          <ArrowLeftRight className="mx-auto mb-3 size-6 opacity-50" />
          {filter === "all" ? "No deals yet." : "Nothing in this filter."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            return (
              <Link
                key={t._id}
                to={`/t/${t.publicId}`}
                className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Store className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{t.title}</p>
                    <Badge variant={STATUS_TONE[t.status]} className="shrink-0">
                      {STATUS_LABELS[t.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatKobo(t.totalKobo)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" /> #{t.publicId.split("_")[1]?.slice(0, 8)}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(t.createdAt)}</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}