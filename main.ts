import { Hono } from "hono";
import { serveStatic } from "hono/deno";

const app = new Hono();

// Baseline security headers for the static SPA shell (Phase 2, §12).
// Applied at the layer that actually exists (Deno/Hono static server).
// A strict Content-Security-Policy is intentionally NOT hard-coded here:
// the app loads provider scripts (Convex, auth, integrations) whose hashes
// change per build. The recommended deployment CSP is documented in
// docs/architecture/authentication-decision.md and belongs on the
// deployment proxy / future Node server.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  // The app is not designed to be framed by arbitrary sites. Same-origin
  // framing keeps the Freebuff preview/dev embed working where same-origin.
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
});

// 1) Serve anything in /assets/**
app.use("/assets/*", serveStatic({ root: "./dist/assets" }));

// 2) Catch *all* other files in dist (CSS, JS, images, etc.)
app.use("*", serveStatic({ root: "./dist" }));

// 3) Fallback to index.html for the SPA
app.get("*", serveStatic({ path: "./dist/index.html" }));

Deno.serve(app.fetch);
