/**
 * API routes: private draft create/edit (Phase 7, §6, §47–§51).
 * POST   /api/v1/transactions/drafts          — create draft
 * PATCH  /api/v1/transactions/drafts/:ref      — edit draft
 *
 * Every route resolves the trusted principal first; public_reference is an
 * identifier, never authorization. Existence-hiding denials.
 */
import { Hono } from "hono";
import type { ApiEnv } from "../middleware.js";
import type { ApiAuth } from "../../auth/apiAuth.js";
import type { TransactionDraftService } from "../../services/TransactionDraftService.js";
import { DraftServiceError } from "../../services/TransactionDraftService.js";
import {
  badRequest,
  notFound,
  unauthenticated,
  writeNotEnabled,
} from "../errors.js";
import { createDraftSchema, editDraftSchema } from "../schemas/draft.js";
import { parsePublicReference } from "../validation.js";

export interface DraftRouteDeps {
  auth: ApiAuth;
  draftService: TransactionDraftService | null;
  writeEnabled: boolean;
}

export function draftRoutes(deps: DraftRouteDeps) {
  const app = new Hono<ApiEnv>();

  // POST /api/v1/transactions/drafts — create private draft
  app.post("/transactions/drafts", async (c) => {
    if (!deps.writeEnabled || !deps.draftService) throw writeNotEnabled();

    const principal = await deps.auth.resolvePrincipal(c.req.raw);
    if (principal === null) throw unauthenticated();

    const idempotencyKey = c.req.header("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw badRequest("Idempotency-Key header is required");
    }
    if (idempotencyKey.length > 256) {
      throw badRequest("Idempotency-Key too long");
    }

    const body = await c.req.json();
    const parsed = createDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
    }

    const requestId = String(c.get("requestId") ?? "");
    try {
      const result = await deps.draftService.createDraft(
        principal,
        parsed.data,
        idempotencyKey,
        requestId,
      );
      return c.json(result.draft, 201);
    } catch (error) {
      if (error instanceof DraftServiceError) {
        return c.json(
          { error: { code: error.code, message: error.message, requestId } },
          error.httpStatus as 400 | 401 | 403 | 404 | 409 | 500,
        );
      }
      throw error;
    }
  });

  // PATCH /api/v1/transactions/drafts/:publicReference — edit draft
  app.patch("/transactions/drafts/:publicReference", async (c) => {
    if (!deps.writeEnabled || !deps.draftService) throw writeNotEnabled();

    const principal = await deps.auth.resolvePrincipal(c.req.raw);
    if (principal === null) throw unauthenticated();

    const reference = parsePublicReference(c.req.param("publicReference"));
    if (reference === null) throw badRequest("Invalid public reference");

    const body = await c.req.json();
    const parsed = editDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
    }

    const requestId = String(c.get("requestId") ?? "");
    try {
      const result = await deps.draftService.editDraft(
        principal,
        reference,
        parsed.data,
        requestId,
      );
      return c.json(result.draft);
    } catch (error) {
      if (error instanceof DraftServiceError) {
        return c.json(
          { error: { code: error.code, message: error.message, requestId } },
          error.httpStatus as 400 | 401 | 403 | 404 | 409 | 500,
        );
      }
      throw error;
    }
  });

  return app;
}
