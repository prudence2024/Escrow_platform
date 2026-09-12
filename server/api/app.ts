/**
 * DealSure API application factory (Phase 4).
 * Hono routes + middleware composed around injected dependencies —
 * injectable auth/db make every route integration-testable without
 * network, servers, or production headers.
 */
import { Hono } from "hono";
import type { ApiAuth } from "../auth/apiAuth.js";
import type { Logger } from "../observability/logger.js";
import type { TransactionQueryService } from "../services/TransactionQueryService.js";
import type { TransactionDraftService } from "../services/TransactionDraftService.js";
import type { UserQueryService } from "../services/UserQueryService.js";
import type { ReadinessDto } from "./dto.js";
import { toApiError, toEnvelope } from "./errors.js";
import {
  REQUEST_ID_HEADER,
  type ApiEnv,
  apiBodyLimit,
  apiCors,
  apiSecurityHeaders,
  requestId,
  requestLogger,
} from "./middleware.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";
import { transactionRoutes } from "./routes/transactions.js";
import { draftRoutes } from "./routes/drafts.js";

export interface AppDeps {
  auth: ApiAuth;
  txService: TransactionQueryService;
  draftService: TransactionDraftService | null;
  userService: UserQueryService;
  checkReadiness: () => Promise<ReadinessDto>;
  corsAllowedOrigins: string[];
  logger: Logger;
  writeEnabled: boolean;
}

export function createApp(deps: AppDeps): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.use("*", requestId());
  app.use("*", apiSecurityHeaders());
  app.use("*", apiCors(deps.corsAllowedOrigins));
  app.use("/api/*", apiBodyLimit());
  app.use("/api/*", requestLogger(deps.logger));

  app.route("/api/v1", healthRoutes({ checkReadiness: deps.checkReadiness }));
  app.route("/api/v1", transactionRoutes({ auth: deps.auth, service: deps.txService }));
  app.route("/api/v1", profileRoutes({ auth: deps.auth, service: deps.userService }));
  app.route("/api/v1", draftRoutes({ auth: deps.auth, draftService: deps.draftService, writeEnabled: deps.writeEnabled }));

  app.notFound((c) => {
    const requestIdValue = String(c.get("requestId") ?? "");
    return c.json(
      { error: { code: "NOT_FOUND", message: "Not found", requestId: requestIdValue } },
      404,
    );
  });

  app.onError((error, c) => {
    const requestIdValue = String(c.get("requestId") ?? "");
    deps.logger.log("error", "unhandled", {
      requestId: requestIdValue,
      route: c.req.routePath,
      method: c.req.method,
      code: error instanceof Error ? error.name : "unknown",
    });
    const apiError = toApiError(error);
    type KnownStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503;
    return c.json(toEnvelope(apiError, requestIdValue), apiError.status as KnownStatus);
  });

  return app;
}

export { REQUEST_ID_HEADER };
