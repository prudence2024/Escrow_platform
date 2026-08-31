import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { CheckCheck, Bell, ShieldCheck, Truck, Scale, CircleDollarSign, PackageCheck, Inbox } from "lucide-react";
import { toast } from "sonner";

function iconFor(type: string) {
  switch (type) {
    case "PAYMENT_SECURED":
    case "SETTLED": return CircleDollarSign;
    case "DISPATCHED":
    case "DELIVERED": return Truck;
    case "READY": return PackageCheck;
    case "TRANSACTION_INVITE":
    case "BUYER_ACCEPTED": return Inbox;
    case "DISPUTE":
    case "DISPUTE_OPENED": return Scale;
    default: return ShieldCheck;
  }
}

export default function Notifications() {
  const notifications = useQuery(api.notifications.myNotifications, {});
  const unread = useQuery(api.notifications.unreadCount, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const list = notifications ?? [];

  const handleOpen = async (n: any) => {
    if (!n.readAt) {
      markRead({ notificationId: n._id }).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            {unread !== undefined && unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        {unread !== undefined && unread > 0 && (
          <Button variant="outline" size="sm" className="gap-2"
            onClick={async () => { await markAllRead(); toast.success("All marked as read"); }}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        )}
      </div>

      {notifications === undefined ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-3 size-6 opacity-50" />
          No alerts yet. We'll let you know when a deal changes.
        </div>
      ) : (
        <div className="grid gap-2">
          {list.map((n: any) => {
            const Icon = iconFor(n.type);
            const unreadFlag = !n.readAt;
            return (
              <button
                key={n._id}
                onClick={() => handleOpen(n)}
                className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/30"
              >
                <div className={unreadFlag ? "grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" : "grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {unreadFlag && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground/80">{formatDateTime(n.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}