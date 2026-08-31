import { format, formatDistanceToNow } from "date-fns";
import { STATUS_LABELS as _SL } from "@/convex/config";
// widen for ergonomic indexing with runtime statuses
export const STATUS_LABELS: Record<string, string> = _SL;

/** kobo -> Naira string. Monetary values are always integer minor units (kobo). */
export function formatKobo(kobo?: number | null): string {
  const naira = (kobo ?? 0) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

export function formatDateTime(ts?: number | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, yyyy · h:mm a");
}

export function formatDate(ts?: number | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, yyyy");
}

export function timeAgo(ts?: number | null): string {
  if (!ts) return "—";
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

export function buildShareUrl(slug: string): string {
  return `${window.location.origin}/t/${slug}`;
}

export const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING_BUYER_ACCEPTANCE: "secondary",
  AWAITING_PAYMENT: "outline",
  PAYMENT_PROCESSING: "secondary",
  PAYMENT_SECURED: "default",
  READY_FOR_DELIVERY: "outline",
  DISPATCHED: "outline",
  DELIVERED_PENDING_INSPECTION: "secondary",
  ACCEPTED: "default",
  RELEASE_PENDING: "secondary",
  SETTLED: "default",
  DISPUTED: "destructive",
  REFUND_PENDING: "secondary",
  REFUNDED: "secondary",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
};