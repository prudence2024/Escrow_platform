// DealSure offline app-shell service worker.
// Caches safe static assets only. Authenticated API responses are NEVER cached
// blindly; state changes (payment, accept, release, refund, dispute) are only
// ever performed online against the Convex backend.

const CACHE = "dealsure-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first for navigations (fresh app shell when online), fallback to cache.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache Convex RPC, auth, or cross-origin API traffic.
  if (url.host !== self.location.host || url.pathname.startsWith("/api/")) {
    return; // let the browser handle normally
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/index.html");
          return cached || Response.error();
        }),
    );
    return;
  }

  // static assets: stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});