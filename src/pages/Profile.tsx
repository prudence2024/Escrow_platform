import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Landmark, IdCard, UserRound, ShieldAlert, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { GithubCard } from "@/components/GithubCard";

export default function Profile() {
  const data = useQuery(api.profile.getOwnProfile, {});
  const updateProfile = useMutation(api.profile.updateProfile);
  const addBank = useMutation(api.profile.addBankAccount);
  const submitKyc = useMutation(api.profile.submitKyc);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [acctName, setAcctName] = useState("");
  const [acctNo, setAcctNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [docType, setDocType] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-56 rounded-2xl" /></div>;
  }

  const user = data.user;
  const kyc = data.kyc;
  const banks = data.bank ?? [];
  const isStaff = user?.role === "admin" || user?.role === "ops";

  const doBusy = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { toast.error(e.message ?? "Something went wrong"); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      {isStaff && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldAlert className="size-4" /></div>
            <div className="flex-1 text-sm">
              <span className="font-medium">Operations access enabled.</span>{" "}
              <span className="text-muted-foreground">You can resolve disputes and review transactions.</span>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/admin">Ops <ArrowRight className="size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Identity */}
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></div>
            <div>
              <CardTitle className="text-base">Your details</CardTitle>
              <CardDescription className="text-sm">Name & contact for your seller profile.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Jane Doe" defaultValue={user?.name ?? ""} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+234…" defaultValue={data.profile?.phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="country">Country</Label>
            <Input id="country" placeholder="Nigeria" defaultValue={data.profile?.country ?? ""} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <Button className="w-fit"
            onClick={() => doBusy("profile", async () => {
              const uname = name || user?.name || undefined;
              await updateProfile({ fullName: uname, phone: phone || undefined, country: country || undefined });
              toast.success("Profile saved");
            })}
            disabled={busy === "profile"}>
            {busy === "profile" && <Loader2 className="size-4 animate-spin" />} Save details
          </Button>
        </CardContent>
      </Card>

      {/* Payout */}
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Landmark className="size-5" /></div>
            <div>
              <CardTitle className="text-base">Payout bank account</CardTitle>
              <CardDescription className="text-sm">Settlements are released to this account once delivery is accepted.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {banks.length > 0 && (
            <div className="grid gap-2">
              {banks.map((b: any) => (
                <div key={b._id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div>
                    <p className="font-medium">{b.accountName}</p>
                    <p className="text-sm text-muted-foreground">{b.bankName} · •••• {b.accountNumber.slice(-4)}</p>
                  </div>
                  <Badge variant={b.status === "PENDING" ? "outline" : "default"}>{b.status}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="acctName">Account name</Label>
              <Input id="acctName" placeholder="Jane Doe" value={acctName} onChange={(e) => setAcctName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acctNo">Account number</Label>
              <Input id="acctNo" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={acctNo} onChange={(e) => setAcctNo(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" placeholder="e.g. GTBank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
          <Button className="w-fit"
            onClick={() => doBusy("bank", async () => {
              if (!acctName || acctNo.length !== 10 || !bankName) { toast.error("Complete the account fields"); return; }
              await addBank({ accountName: acctName, accountNumber: acctNo, bankName });
              setAcctName(""); setAcctNo(""); setBankName("");
              toast.success("Payout account saved");
            })}
            disabled={busy === "bank"}>
            {busy === "bank" && <Loader2 className="size-4 animate-spin" />} Add payout account
          </Button>
        </CardContent>
      </Card>

      {/* GitHub integration */}
      <GithubCard />

      {/* KYC */}
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><IdCard className="size-5" /></div>
            <div>
              <CardTitle className="text-base">Identity verification</CardTitle>
              <CardDescription className="text-sm">Verification unlocks higher transaction limits and builds buyer trust.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">KYC status</span>
            <Badge variant={kyc?.status === "VERIFIED" ? "default" : "outline"}>{kyc?.status ?? "NOT SUBMITTED"}</Badge>
          </div>
          {kyc?.status !== "VERIFIED" && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>ID document type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="driver_license">Driver's license</SelectItem>
                    <SelectItem value="voters_card">Voter's card</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="gap-2"
                onClick={() => doBusy("kyc", async () => {
                  if (!docType) { toast.error("Select a document type"); return; }
                  await submitKyc({ docType });
                  toast.success("KYC submitted — under review");
                })}
                disabled={busy === "kyc"}>
                {busy === "kyc" && <Loader2 className="size-4 animate-spin" />} Submit for review
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}