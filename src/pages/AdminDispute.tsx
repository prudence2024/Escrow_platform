import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatKobo, formatDateTime } from "@/lib/format";
import { ArrowLeft, Scale, Send, Loader2, Target, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function AdminDispute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const data = useQuery(api.admin.disputeDetail, id ? { disputeId: id as any } : "skip");
  const resolve = useMutation(api.disputes.resolveDispute);
  const message = useMutation(api.disputes.message);
  const addEvidence = useMutation(api.disputes.addEvidence);

  const [msg, setMsg] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("seller_settlement");
  const [refundKobo, setRefundKobo] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!user || (user.role !== "admin" && user.role !== "ops")) {
    return <div className="py-16 text-center text-muted-foreground">Operations access required.</div>;
  }
  if (data === undefined) return <div className="flex flex-col gap-4"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  const { dispute, transaction } = data;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { toast.error(e.message ?? "Action failed"); }
    finally { setBusy(null); }
  };

  const toKobo = (naira: string) => Math.max(0, Math.round(Number(naira || "0") * 100));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/admin")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Ops console
        </button>
        <Badge variant={dispute.status === "OPEN" ? "destructive" : "secondary"}>{dispute.status}</Badge>
      </div>

      {/* Transaction context */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">{transaction?.title ?? "Transaction"}</CardTitle>
          <CardDescription className="text-sm">
            {formatKobo(transaction?.totalKobo)} · <span className="font-mono">{transaction?.publicId}</span> · Status: {transaction?.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p className="font-medium">{dispute.reason}</p>
          {dispute.details && <p className="text-muted-foreground">{dispute.details}</p>}
          <p className="text-xs text-muted-foreground pt-1">Opened {formatDateTime(dispute.createdAt)} by {dispute.openedBy.slice(0, 8)}</p>
          {dispute.resolution && <p className="text-xs font-medium pt-1">Resolution: {dispute.resolution} · {formatDateTime(dispute.resolvedAt)}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Messages */}
        <Card className="border-border/70">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="size-4" /> Messages</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {(data.messages ?? []).map((m: any) => (
                <div key={m._id} className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p>{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.authorId.slice(0, 8)} · {formatDateTime(m.createdAt)}</p>
                </div>
              ))}
              {(data.messages ?? []).length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Reply…" value={msg} onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && msg.trim()) run("msg", () => message({ disputeId: id as any, body: msg }).then(() => setMsg(""))); }} />
              <Button size="icon" disabled={busy === "msg" || !msg.trim()} onClick={() => run("msg", () => message({ disputeId: id as any, body: msg }).then(() => setMsg("")))}>
                <Send className="size-4" />
              </Button>
            </div>
            <div className="grid gap-2 border-t border-border/60 pt-3">
              <Label htmlFor="ev">Add evidence URL (image/pdf)</Label>
              <div className="flex gap-2">
                <Input id="ev" placeholder="https://…" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
                <Button variant="outline" disabled={!evidenceUrl.startsWith("http")} onClick={() => run("ev", () => addEvidence({ disputeId: id as any, url: evidenceUrl }).then(() => setEvidenceUrl("")))}>
                  Add
                </Button>
              </div>
              {(data.evidence ?? []).map((e: any) => (
                <a key={e._id} href={e.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary hover:underline">{e.url}</a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resolution */}
        <Card className="border-border/70">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> Resolution</CardTitle></CardHeader>
          <CardContent className="grid gap-3" style={{opacity: dispute.status === "OPEN" ? 1 : 0.5}}>
            <div className="grid gap-1.5">
              <Label>Decision</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller_settlement">Release to seller</SelectItem>
                  <SelectItem value="buyer_refund">Full refund to buyer</SelectItem>
                  <SelectItem value="partial_refund">Partial refund to buyer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {decision === "partial_refund" && (
              <div className="grid gap-1.5">
                <Label>Refund amount (₦)</Label>
                <Input type="number" inputMode="decimal" value={refundKobo} onChange={(e) => setRefundKobo(e.target.value)} placeholder={String(Math.round((transaction?.totalKobo ?? 0) / 100))} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="note">Ops note (audited)</Label>
              <Input id="note" placeholder="Reason for this decision" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button className="gap-2" variant="default"
              disabled={busy === "resolve" || dispute.status !== "OPEN" || !note.trim()}
              onClick={() => run("resolve", () =>
                resolve({
                  disputeId: id as any,
                  decision: decision as any,
                  refundKobo: decision === "partial_refund" ? toKobo(refundKobo) : undefined,
                  note,
                }).then((res: any) => {
                  toast.success(`Resolved: ${res.decision} (${res.status ?? res.outcome ?? "done"})`);
                  setNote("");
                })
              )}>
              {busy === "resolve" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Confirm decision
            </Button>
            {dispute.status !== "OPEN" && (
              <p className="text-sm text-muted-foreground">This dispute has already been resolved.</p>
            )}
            {transaction && (
              <Link to={`/t/${transaction.publicId}`} className="text-xs text-primary hover:underline">View full transaction →</Link>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Scale className="size-3.5" /> All decisions are recorded in the audit log with your ops note.
      </p>
    </div>
  );
}