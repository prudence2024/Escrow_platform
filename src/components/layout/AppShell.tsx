import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import {
  Home,
  ArrowLeftRight,
  PlusCircle,
  Bell,
  UserRound,
  ShieldCheck,
  LogOut,
  Wifi,
  WifiOff,
  Download,
  Sparkles,
} from "lucide-react";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/transactions", label: "Deals", icon: ArrowLeftRight },
  { to: "/transactions/new", label: "Create", icon: PlusCircle, create: true },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useQuery(api.notifications.unreadCount, {});
  const isStaff = user?.role === "admin" || user?.role === "ops";

  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // install prompt
  const [installEvt, setInstallEvt] =
    useState<{ prompt: () => void } | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt({ prompt: () => (e as any).prompt() });
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const [hideInstall, setHideInstall] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  const isActive = (to: string) =>
    to === "/transactions"
      ? location.pathname.startsWith("/t/") ||
        location.pathname.startsWith("/transactions")
      : location.pathname.startsWith(to);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur px-4 py-6 sticky top-0 h-dvh">
        <Link to="/home" className="flex items-center gap-2 px-2 mb-8">
          <img src={logo} alt="No Ojoro" className="size-9 rounded-xl" />
          <div>
            <p className="font-semibold tracking-tight leading-none">No Ojoro</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">protected payments</p>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, create }) => (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                create && "text-primary",
                isActive(to) && to !== "/transactions/new"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {label}
              {to === "/notifications" && (unread ?? 0) > 0 && (
                <span className="ml-auto size-2 rounded-full bg-primary" />
              )}
            </NavLink>
          ))}
          {isStaff && (
            <NavLink
              to="/admin"
              className={({ isActive: a }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors mt-2",
                  a ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <ShieldCheck className="size-[18px]" />
              Operations
            </NavLink>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            {online ? (
              <Wifi className="size-3.5" />
            ) : (
              <WifiOff className="size-3.5" />
            )}
            {online ? "Online" : "Offline — changes held"}
          </div>
          <Button
            variant="ghost"
            className="justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-background/80 backdrop-blur border-b border-border/60">
          <Link to="/home" className="flex items-center gap-2">
            <img src={logo} alt="No Ojoro" className="size-8 rounded-lg" />
            <span className="font-semibold tracking-tight">No Ojoro</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {!online && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                <WifiOff className="size-3" /> offline
              </span>
            )}
            <Link
              to="/notifications"
              className="relative grid size-9 place-items-center rounded-full hover:bg-muted"
            >
              <Bell className="size-4" />
              {(unread ?? 0) > 0 && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Link>
          </div>
        </header>

        {/* Install banner */}
        {installEvt && !hideInstall && (
          <div className="mt-3 mx-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Download className="size-4" />
            </div>
            <div className="flex-1 text-sm font-medium">Add No Ojoro to your home screen</div>
            <button
              className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
              onClick={async () => {
                await installEvt.prompt();
                setHideInstall(true);
              }}
            >
              Install
            </button>
            <button
              className="text-muted-foreground text-xs"
              onClick={() => setHideInstall(true)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 pb-28 lg:pb-10 lg:px-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/90 backdrop-blur-lg"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
            {NAV.map(({ to, label, icon: Icon, create }) => (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                  isActive(to)
                    ? create
                      ? "text-primary"
                      : "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {create ? (
                  <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className="size-5" />
                )}
                {label}
                {to === "/notifications" && (unread ?? 0) > 0 && (
                  <span className="absolute top-0 right-1/2 translate-x-4 size-1.5 rounded-full bg-primary" />
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
      <Sparkles className="size-6 opacity-50" />
      {children}
    </div>
  );
}

export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}