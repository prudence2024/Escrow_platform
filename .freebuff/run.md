# DealSure (Deal Secure) — Local Dev Preview Run Doc

Vite + React 19 SPA (`npm run dev`), PWA shell in `public/`, Convex backend in `src/convex/`.

## Reproduce uncommitted artifacts

- `.env.local` (git-ignored) must exist: `main.tsx` constructs the Convex client from
  `VITE_CONVEX_URL`, and without it the constructor throws and the whole app renders
  blank. Copy `.env.local` from the main checkout, or create one locally. A placeholder
  value (`http://127.0.0.1:4799`) is enough for the UI shell to render; live queries
  require a running Convex deployment (`npx convex dev` or a real deployment URL).
  `.env.example` holds only placeholders.
- Dependencies: install once with `npm install` (project ships `bun.lock`; the main
  checkout was installed with npm since bun was unavailable). `node_modules/` must exist
  before `npm run dev`.

## Run the server

Default Vite port is 5173. If another thread already runs the app there, start a second
instance on a free port with strict mode:

```bash
npm run dev -- --port 5174 --strictPort
```

Detached (Windows), logging stdout/stderr to separate files:

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev','--','--port','5174','--strictPort' -RedirectStandardOutput '<log>.log' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

Confirm with `Get-Process -Id <pid>` and `curl http://localhost:5174/` (expect HTTP 200).

Note: port 3000 may be occupied by an unrelated service (unused by this app).
