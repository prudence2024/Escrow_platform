import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatKobo } from "@/lib/format";
import { CATEGORIES } from "@/convex/config";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";

const schema = z.object({
  title: z.string().min(3, "Give your deal a short title"),
  category: z.string().min(1, "Pick a category"),
  condition: z.string().optional(),
  amount: z.coerce.number().min(1, "Enter an amount"),
  deliveryFee: z.coerce.number().min(0).default(0),
  description: z.string().min(10, "Describe the item or service"),
  deadline: z.string().optional(),
  inspectionDays: z.coerce.number().min(1).max(30).default(3),
  returnTerms: z.string().optional(),
  buyerEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const toKobo = (naira: number) => Math.round(naira * 100);

export default function CreateTransaction() {
  const navigate = useNavigate();
  const create = useMutation(api.transactions.create);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    // zod v4 + RHF typing: coerce inputs resolve to numbers; cast to satisfy union
    resolver: zodResolver(schema) as any,
    defaultValues: { deliveryFee: 0, inspectionDays: 3, amount: 0 },
  });

  const amount = watch("amount") || 0;
  const deliveryFee = watch("deliveryFee") || 0;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const deadlineAt = values.deadline
        ? new Date(`${values.deadline}T23:59:59`).getTime()
        : undefined;
      const res = await create({
        title: values.title,
        category: values.category,
        condition: values.condition || undefined,
        amountKobo: toKobo(values.amount),
        deliveryFeeKobo: toKobo(values.deliveryFee),
        description: values.description,
        agreedDeadlineAt: deadlineAt,
        inspectionWindowDays: values.inspectionDays,
        returnTerms: values.returnTerms || undefined,
        buyerEmail: values.buyerEmail || undefined,
      });
      toast.success("Deal created — share the secure link to invite a buyer");
      navigate(`/t/${res.publicId}`);
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Protect a deal</h1>
          <p className="text-sm text-muted-foreground">
            The buyer will pay securely after accepting these terms. You're paid after
            delivery is accepted.
          </p>
        </div>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">What are you selling?</CardTitle>
          <CardDescription>Item, service, price and delivery terms.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. iPhone 13, 128GB — clean condition" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select onValueChange={(v) => setValue("category", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="condition">Condition (optional)</Label>
              <Input id="condition" placeholder="New / Used / Refurbished" {...register("condition")} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="amount">Price (₦)</Label>
              <Input id="amount" type="number" inputMode="decimal" min={0} step="0.01" placeholder="25000" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deliveryFee">Delivery fee (₦)</Label>
              <Input id="deliveryFee" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" {...register("deliveryFee")} />
            </div>
          </div>

          <div className="rounded-xl bg-muted/60 p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Buyer total</span>
            <span className="font-semibold">{formatKobo(toKobo(amount) + toKobo(deliveryFee))}</span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} placeholder="Describe what's included, condition, authenticity, etc." {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="deadline">Delivery deadline (optional)</Label>
              <Input id="deadline" type="date" {...register("deadline")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inspectionDays">Inspection window (days)</Label>
              <Input id="inspectionDays" type="number" min={1} max={30} {...register("inspectionDays")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="returnTerms">Return / cancellation terms</Label>
            <Textarea id="returnTerms" rows={2} placeholder="Optional: return within X days if item doesn't match description…" {...register("returnTerms")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="buyerEmail">Buyer email (optional)</Label>
            <Input id="buyerEmail" type="email" placeholder="Invite a buyer by email" {...register("buyerEmail")} />
            {errors.buyerEmail && <p className="text-xs text-destructive">{errors.buyerEmail.message}</p>}
          </div>

          <Button type="button" className="mt-2 w-full gap-2" disabled={submitting} onClick={handleSubmit(onSubmit)}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {submitting ? "Creating…" : "Create deal & generate secure link"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}