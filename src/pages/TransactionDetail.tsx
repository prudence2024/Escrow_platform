import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatKobo, formatDateTime, buildShareUrl, STATUS_LABELS, STATUS_TONE } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Share2, Copy, CheckCircle2, Loader2, ArrowLeft,
  PackageCheck, Truck, Lock, Scale, Inbox, CircleDollarSign, MessageSquareQuote,
} from "lucide-react";

type TxView = any;

function ActionCard({ icon, title, body, children }: { icon: React.ReactNode; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {body && <CardDescription className="mt-1 text-sm">{body}</CardDescription>}
        </div>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}

function DispatchCard({ busy, value, setValue, onDispatch }: any) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Truck className="size-5" />
        </div>
        <div>
          <CardTitle className="text-base">Dispatch the item</CardTitle>
          <CardDescription className="mt-1 text-sm">Add courier details — a one-time delivery code will be generated.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Courier / bus company</Label>
            <Input placeholder="e.g. GIG Logistics" value={value.courier ?? ""} onChange={(e) => setValue({ ...value, courier: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tracking number (optional)</Label>
            <Input placeholder="e.g. 123456789" value={value.tracking ?? ""} onChange={(e) => setValue({ ...value, tracking: e.target.value })} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="carrierDetail">Extra delivery notes (optional)</Label>
            <Input id="carrierDetail" placeholder="Box colour, recipient instructions…" value={value.carrier ?? ""} onChange={(e) => setValue({ ...value, carrier: e.target.value })} />
          </div>
          <Button className="sm:col-span-2 gap-2" disabled={busy === "dispatch"} onClick={onDispatch}>
            {busy === "dispatch" ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
            Dispatch & generate delivery code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ h }: { h: any }) {
  return (
    <div className="flex gap-3">
      <div className={cn("mt-1 grid size-3 shrink-0 place-items-center rounded-full", ["SETTLED", "ACCEPTED"].includes(h.toStatus) ? "bg-primary" : "bg-border")}>
        <span className="size-1 rounded-full bg-background" />
      </div>
      <div className="min-w-0 pb-5">
        <p className="text-sm font-medium">{STATUS_LABELS[h.toStatus]}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(h.at)}
          {h.reason ? ` · ${h.reason}` : ""}
        </p>
      </div>
    </div>
  );
}

const SEC_STATES = ["PAYMENT_SECURED", "READY_FOR_DELIVERY", "DISPATCHED", "DELIVERED_PENDING_INSPECTION", "ACCEPTED", "RELEASE_PENDING"];

export default function TransactionDetail() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const tx = useQuery(api.transactions.detail, reference ? { publicId: reference } : "skip");

  const publish = useMutation(api.transactions.publish);
  const acceptTerms = useMutation(api.transactions.acceptTerms);
  const requestPayment = useMutation(api.payments.requestPayment);
  const confirmPayment = useMutation(api.payments.confirmPayment);
  const markReady = useMutation(api.transactions.markReady);
  const dispatch = useMutation(api.delivery.dispatch);
  const confirmDelivery = useMutation(api.delivery.confirmDelivery);
  const acceptDelivery = useMutation(api.settlement.accept);
  const cancel = useMutation(api.transactions.cancel);
  const openDispute = useMutation(api.disputes.open);

  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [otp, setOtp] = useState("");
  const [dispatchInfo, setDispatchInfo] = useState<{ courier?: string; tracking?: string; carrier?: string }>({});
  const [otpIssue, setOtpIssue] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDetails, setDisputeDetails] = useState("");

  if (tx === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }
  const data: TxView = tx;
  const perm = data.permissions;
  const shareUrl = buildShareUrl(data.slug);
  const secState = SEC_STATES.includes(data.status);
  const inspectionDeadline = data.deliveries?.[0]?.inspectionDeadlineAt;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Secure link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — tap the link to select it");
    }
  };

  const isSeller = !!perm.isSeller;
  const isBuyer = !!perm.isParticipant;

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </button>

      {data.status === "DISPUTED" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"><Scale className="size-5" /></div>
            <div>
              <CardTitle className="text-base">Dispute open</CardTitle>
              <CardDescription className="mt-1 text-sm">
                Settlement is blocked while this dispute is being reviewed. Add your side via the timeline below.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Status hero */}
      <div className="rounded-3xl border border-border/70 bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", secState || data.status === "SETTLED" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
              {data.status === "SETTLED" || data.status === "REFUNDED" ? <CircleDollarSign className="size-5" /> : secState ? <ShieldCheck className="size-5" /> : <PackageCheck className="size-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">{data.title}</h1>
                <Badge variant={STATUS_TONE[data.status]}>{data.statusLabel}</Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{formatKobo(data.totalKobo)}</span>
                <span>·</span><span className="font-mono text-xs">#{data.publicId.split("_")[1]?.slice(0, 10)}</span>
                <span>·</span>{data.category}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:max-w-md">
          {[
            { l: "Item price", v: formatKobo(data.amountKobo) },
            { l: "Delivery", v: formatKobo(data.deliveryFeeKobo) },
            { l: "Total", v: formatKobo(data.totalKobo) },
          ].map((c) => (
            <div key={c.l} className="rounded-xl bg-muted/50 p-2.5">
              <p className="text-[11px] text-muted-foreground">{c.l}</p>
              <p className="text-sm font-semibold">{c.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Seller share link */}
      {["DRAFT", "PENDING_BUYER_ACCEPTANCE"].includes(data.status) && isSeller && (
        <Card className="border-border/70">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Share2 className="size-5" /></div>
            <div>
              <CardTitle className="text-base">Secure invite link</CardTitle>
              <CardDescription className="mt-1 text-sm">
                {data.status === "DRAFT" ? "Publish to activate this link and invite a buyer." : "Share this link — the buyer will review terms and pay securely."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={copyShare} title="Copy link">
                {copied ? <CheckCircle2 className="size-4 text-primary" /> : <Copy className="size-4" />}
              </Button>
            </div>
            {data.status === "DRAFT" ? (
              <Button className="gap-2" disabled={busy === "publish"} onClick={() => run("publish", async () => { await publish({ publicId: data.publicId }); toast.success("Link is live — you can now invite a buyer"); })}>
                {busy === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                Publish & generate live link
              </Button>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Inbox className="size-3.5" /> Waiting for the buyer to accept your terms.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buyer: accept terms (shown to the invitee over the shared link too) */}
      {data.status === "PENDING_BUYER_ACCEPTANCE" && !isSeller && (
        <ActionCard icon={<Scale className="size-5" />} title="Review & accept terms"
          body={`The seller is asking for ${formatKobo(data.totalKobo)}. Review the description, return terms and delivery window before committing — payment is secured with our payment partner and the seller is only paid after you accept the item.`}>
          <div className="flex gap-2">
            <Button onClick={() => run("acceptTerms", () => acceptTerms({ reference: data.publicId }))} disabled={busy === "acceptTerms"} className="gap-2">
              {busy === "acceptTerms" && <Loader2 className="size-4 animate-spin" />} Accept terms
            </Button>
            <Button variant="outline" onClick={() => run("cancel", () => cancel({ publicId: data.publicId, reason: "Buyer declined" }))} disabled={busy === "cancel"}>
              Decline
            </Button>
          </div>
        </ActionCard>
      )}

      {/* Buyer: pay */}
      {data.status === "AWAITING_PAYMENT" && isBuyer && (
        <ActionCard icon={<Lock className="size-5" />} title="Make a secure payment"
          body={`Pay ${formatKobo(data.totalKobo)} now. Funds are held with our payment partner and only released after you accept delivery.`}>
          <Button className="w-full gap-2" disabled={busy === "pay"}
            onClick={() => run("pay", async () => {
              const key = crypto.randomUUID();
              await requestPayment({ reference: data.publicId, idempotencyKey: key });
              await confirmPayment({ reference: data.publicId, idempotencyKey: key });
              toast.success("Payment verified — the seller can now deliver");
            })}>
            {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {busy === "pay" ? "Verifying payment…" : `Pay ${formatKobo(data.totalKobo)} securely`}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">Demo checkout — payment success is verified server-side with the mock payment provider.</p>
        </ActionCard>
      )}

      {data.status === "PAYMENT_PROCESSING" && isBuyer && (
        <ActionCard icon={<Loader2 className="size-5" />} title="Completing payment"
          body="We're confirming payment with our payment partner. This step is verified server-side — nothing is released until it's confirmed.">
          <Button className="w-full gap-2" disabled={busy === "pay"} onClick={() => run("pay", () => confirmPayment({ reference: data.publicId, idempotencyKey: crypto.randomUUID() }))}>
            {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : "Re-check payment status"}
          </Button>
        </ActionCard>
      )}

      {/* Seller: ready + dispatch */}
      {data.status === "PAYMENT_SECURED" && isSeller && (
        <ActionCard icon={<ShieldCheck className="size-5" />} title="Payment secured"
          body="The buyer has paid. Funds are held safely with our payment partner and will be released once delivery is accepted.">
          <Button className="gap-2" disabled={busy === "ready"} onClick={() => run("ready", () => markReady({ publicId: data.publicId }))}>
            {busy === "ready" && <Loader2 className="size-4 animate-spin" />} Ready to deliver
          </Button>
        </ActionCard>
      )}
      {["PAYMENT_SECURED", "READY_FOR_DELIVERY"].includes(data.status) && isSeller && (
        <DispatchCard busy={busy as string} value={dispatchInfo} setValue={setDispatchInfo}
          onDispatch={() =>
            run("dispatch", async () => {
              const res = await dispatch({ reference: data.publicId, courierName: dispatchInfo.courier, trackingNumber: dispatchInfo.tracking, carrierDetails: dispatchInfo.carrier });
              if (res?.deliveryOtp) {
                setOtpIssue(res.deliveryOtp);
                toast.success("Dispatched — share the one-time delivery code with your buyer.");
              }
            })
          } />
      )}

      {/* Seller: delivery code */}
      {data.status === "DISPATCHED" && isSeller && otpIssue && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center justify-center gap-2 text-sm font-medium"><Truck className="size-4" /> Share this one-time delivery code with your buyer</p>
          <p className="mt-2 text-center font-mono text-3xl font-bold tracking-[0.5em] text-primary">{otpIssue}</p>
          <p className="mt-2 text-center text-xs text-muted-foreground">The buyer enters it to confirm they received the item.</p>
        </Card>
      )}

      {/* Buyer: confirm delivery via OTP */}
      {data.status === "DISPATCHED" && isBuyer && (
        <ActionCard icon={<Truck className="size-5" />} title="Confirm you received the item"
          body="Enter the one-time delivery code from the seller to mark the item received. Your inspection window starts after this.">
          <div className="grid gap-2">
            <Input inputMode="numeric" maxLength={6} placeholder="••••••" value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-2xl tracking-[0.5em]" />
            <Button className="w-full gap-2" disabled={busy === "confirm" || otp.length !== 6}
              onClick={() => run("confirm", () => confirmDelivery({ reference: data.publicId, otp }))}>
              {busy === "confirm" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirm delivery
            </Button>
            <p className="text-[11px] text-muted-foreground">Demo: the seller sees this code in their view after dispatching.</p>
          </div>
        </ActionCard>
      )}

      {/* Buyer: inspection / accept / dispute */}
      {data.status === "DELIVERED_PENDING_INSPECTION" && isBuyer && (
        <ActionCard icon={<Inbox className="size-5" />} title="Item delivered — inspect it first"
          body={`Your inspection window closes ${inspectionDeadline ? `on ${formatDateTime(inspectionDeadline)}` : "after the agreed inspection period"}. Accept to release the seller's funds, or open a dispute if something isn't right.`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="gap-2" disabled={busy === "accept"} onClick={() => run("accept", () => acceptDelivery({ reference: data.publicId }))}>
              {busy === "accept" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Accept & release funds
            </Button>
            <Button variant="outline" className="gap-2 text-destructive" onClick={() => setShowDispute(true)}>
              <Scale className="size-4" /> Open a dispute
            </Button>
          </div>
        </ActionCard>
      )}

      {data.status === "ACCEPTED" && (
        <ActionCard icon={<CheckCircle2 className="size-5" />} title="Accepted — releasing funds"
          body="Delivery was accepted and the release conditions are met. Funds are being released to the seller through our payment partner." />
      )}
      {data.status === "RELEASE_PENDING" && (
        <ActionCard icon={<CircleDollarSign className="size-5" />} title="Release pending"
          body="Settlement with the payment partner is being finalised. The seller will receive their funds shortly." />
      )}
      {data.status === "SETTLED" && (
        <ActionCard icon={<CircleDollarSign className="size-5" />} title="Settled"
          body="Payment has been released to the seller. This deal is complete and both sides are protected." />
      )}
      {data.status === "REFUNDED" && (
        <ActionCard icon={<Scale className="size-5" />} title="Refunded"
          body="The buyer received a refund through our payment partner. This deal is now closed." />
      )}

      {/* General dispute entry (post-payment, before settlement) */}
      {data.permissions.canOpenDispute && !["DELIVERED_PENDING_INSPECTION", "DISPUTED", "ACCEPTED", "RELEASE_PENDING", "SETTLED", "REFUNDED"].includes(data.status) && (
        <Card className="border-destructive/20">
          <CardContent className="pt-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Scale className="size-4 text-destructive" /> Something wrong with this deal?</p>
            <Button variant="outline" className="text-destructive" onClick={() => setShowDispute(true)}>Open a dispute</Button>
          </CardContent>
        </Card>
      )}

      {/* Dispute dialog */}
      <Dialog open={showDispute} onOpenChange={setShowDispute}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a dispute</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="dreason">Reason</Label>
              <Input id="dreason" placeholder="e.g. Item not as described" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ddetails">Details (optional)</Label>
              <Textarea id="ddetails" rows={3} placeholder="Explain what happened — you can add evidence after opening." value={disputeDetails} onChange={(e) => setDisputeDetails(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispute(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy === "dispute" || !disputeReason.trim()}
              onClick={() => run("dispute", () =>
                openDispute({ reference: data.publicId, reason: disputeReason, details: disputeDetails || undefined }).then(() => {
                  setShowDispute(false); setDisputeReason(""); setDisputeDetails("");
                  toast.success("Dispute opened — settlement is now blocked");
                })
              )}>
              {busy === "dispute" && <Loader2 className="size-4 animate-spin" />} Open dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute thread (if any) */}
      {data.disputes?.length > 0 && (
        <Card className="border-border/70">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquareQuote className="size-4" /> Dispute</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.disputes.map((d: any) => (
              <div key={d._id} className="rounded-xl bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.reason}</span>
                  <Badge variant={d.status === "OPEN" ? "destructive" : "secondary"}>{d.status}</Badge>
                </div>
                {d.details && <p className="mt-1 text-muted-foreground">{d.details}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</p>
                {d.resolution && <p className="mt-2 text-xs font-medium">Resolution: {d.resolution}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card className="border-border/70">
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent>
          {[...(data.history ?? [])].sort((a: any, b: any) => a.at - b.at).map((h: any) => (
            <TimelineItem key={h._id} h={h} />
          ))}
        </CardContent>
      </Card>

      {/* Terms */}
      <Card className="border-border/70">
        <CardHeader><CardTitle className="text-base">Terms & details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <p className="leading-6 text-muted-foreground">{data.description}</p>
          <div className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Condition</p><p className="font-medium">{data.condition || "Not specified"}</p></div>
            <div><p className="text-xs text-muted-foreground">Delivery deadline</p><p className="font-medium">{data.agreedDeadlineAt ? formatDateTime(data.agreedDeadlineAt) : "Not specified"}</p></div>
            <div><p className="text-xs text-muted-foreground">Inspection window</p><p className="font-medium">{data.inspectionWindowDays ?? 0} days</p></div>
            <div><p className="text-xs text-muted-foreground">Return terms</p><p className="font-medium">{data.returnTerms || "None stated"}</p></div>
          </div>
          <div className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
            Reference <span className="font-mono">{data.publicId}</span> · {data.seller ? `Seller: ${data.seller.name}` : ""}{data.buyer ? ` · Buyer: ${data.buyer.name}` : ""}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}