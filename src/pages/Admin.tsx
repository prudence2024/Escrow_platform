import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatKobo, formatDateTime, STATUS_LABELS, STATUS_TONE } from "@/lib/format";
import { ShieldAlert, Scale, ArrowLeftRight, Megaphone, ScrollText, ChevronRight, Landmark } from "lucide-react";

const TABS = [
  { key: "deals", label: "Deals", icon: ArrowLeftRight },
  { key: "disputes", label: "Disputes", icon: Scale },
  { key: "payments", label: "Payments", icon: Landmark },
  { key: "audit", label: "Audit log", icon: ScrollText },
];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("deals");
  const deals = useQuery(api.transactions.list, {});
  const disputes = useQuery(api.admin.listDisputes, {});
  const payments = useQuery(api.admin.listPayments, {});
  const audit = useQuery(api.admin.auditLog, {});

  if (!user || (user.role !== "admin" && user.role !== "ops")) {
    return (
      <div className="rounded-3xl border bg-card p-10 text-center">
        <ShieldAlert className="mx-auto mb-3 size-8 text-destructive/60" />
        <h2 className="text-lg font-semibold">Operations access required</h2>
        <p className="mt-1 text-sm text-muted-foreground">This area is for Deal Secure operations & admin staff only.</p>
      </div>
    );
  }

  const loading = deals === undefined && tab === "deals";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><Megaphone className="size-4" /> Operations</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Admin console</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
            )}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "deals" && (
        loading ? <Skeletons /> : (
          <div className="grid gap-2">
            {(deals ?? []).map((t: any) => (
              <Link key={t._id} to={`/t/${t.publicId}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/30">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatKobo(t.totalKobo)} · <span className="font-mono">{t.publicId}</span> · {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <Badge variant={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )
      )}

      {tab === "disputes" && (
        (disputes === undefined ? <Skeletons /> : (
          <div className="grid gap-2">
            {(disputes ?? []).map((d: any) => (
              <Link key={d._id} to={`/admin/disputes/${d._id}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 hover:border-primary/30">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.reason}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Opened {formatDateTime(d.createdAt)} · {d.details}</p>
                </div>
                <Badge variant={d.status === "OPEN" ? "destructive" : "secondary"}>{d.status}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
            {(disputes ?? []).length === 0 && <Empty text="No disputes to review." />}
          </div>
        ))
      )}

      {tab === "payments" && (
        (payments === undefined ? <Skeletons /> : (
          <Card><CardContent className="pt-5">
            <div className="grid gap-2">
              {(payments ?? []).map((p: any) => (
                <div key={p._id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatKobo(p.amountKobo)} · {p.provider}</p>
                    <p className="text-xs text-muted-foreground">{p.status} · {formatDateTime(p.createdAt)}{p.providerEventId ? ` · ${p.providerEventId.slice(0, 24)}` : ""}</p>
                  </div>
                  <Badge variant={p.status === "SECURED" || p.status === "REFUNDED" ? "default" : "outline"}>{p.status}</Badge>
                </div>
              ))}
              {(payments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No payment events yet.</p>}
            </div>
          </CardContent></Card>
        ))
      )}

      {tab === "audit" && (
        (audit === undefined ? <Skeletons /> : (
          <Card><CardContent className="pt-5">
            <div className="grid gap-1.5">
              {(audit ?? []).map((a: any) => (
                <div key={a._id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-muted-foreground">{formatDateTime(a.at)}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {a.entityType}/{a.entityId.slice(0, 10)}{a.from ? ` · ${a.from} → ${a.to ?? ""}` : ""}{a.reason ? ` · "${a.reason}"` : ""}
                  </p>
                </div>
              ))}
              {(audit ?? []).length === 0 && <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
            </div>
          </CardContent></Card>
        ))
      )}
    </div>
  );
}

function Skeletons() {
  return <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{text}</p>;
}