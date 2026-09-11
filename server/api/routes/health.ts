/**
 * API routes: health + readiness (Phase 4, §6, §33).
 * Public by design; readiness exposes counts only — no internals.
 */
import { Hono } from "hono";
import type { ApiEnv } from "../middleware.js";
import type { ReadinessDto } from "../dto.js";

export interface HealthDeps {
  checkReadiness: () => Promise<ReadinessDto>;
}

export function healthRoutes(deps: HealthDeps) {
  const app = new Hono<ApiEnv>();
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/readiness", async (c) => {
    const report = await deps.checkReadiness();
    const status = report.ready ? 200 : 503;
    return c.json(report, status);
  });
  return app;
}
