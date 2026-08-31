import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import "./types/global.d.ts";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Transactions = lazy(() => import("./pages/Transactions.tsx"));
const CreateTransaction = lazy(() => import("./pages/CreateTransaction.tsx"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminDispute = lazy(() => import("./pages/AdminDispute.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

// Register a lightweight service worker (production only) that caches the
// static app shell for an offline-friendly installable PWA.
function ServiceWorkerRegistration() {
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell is best-effort */
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.dispatchEvent(new Event("app-update-ready"));
      });
    }
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VlyToolbar />
    <InstrumentationProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <ServiceWorkerRegistration />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/home" />}
              />
              <Route
                element={
                  <RequireAuth>
                    <AppShellRoute />
                  </RequireAuth>
                }
              >
                <Route path="/home" element={<Home />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/transactions/new" element={<CreateTransaction />} />
                <Route path="/t/:reference" element={<TransactionDetail />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/disputes/:id" element={<AdminDispute />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </StrictMode>,
);

// Keep the shell import here so AppShell stays in the protected tree.
import { AppShell } from "@/components/layout/AppShell";
function AppShellRoute() {
  return <AppShell />;
}