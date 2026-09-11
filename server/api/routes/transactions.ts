/**
 * API routes: transaction reads (Phase 4, §6, §19–§21).
 * Every route resolves the trusted principal first; public_reference is an
 * identifier, never authorization (§21). Existence-hiding denials (§7).
 */
import { Hono } from "hono";
import type { ApiEnv } from "../middleware.js";
import type { ApiAuth } from "../../auth/apiAuth.js";
import type { TransactionQueryService } from "../../services/TransactionQueryService.js";
import { AuthorizationError } from "../../services/TransactionQueryService.js";
import { badRequest, notFound, unauthenticated } from "../errors.js";
import {
  parseInviteSlug,
  parsePagination,
  parsePublicReference,
  parseTransactionListFilter,
} from "../validation.js";

export interface TransactionRouteDeps {
  auth: ApiAuth;
  service: TransactionQueryService;
}

export function transactionRoutes(deps: TransactionRouteDeps) {
  const app = new Hono<ApiEnv>();

  app.get("/transactions", async (c) => {
    const principal = await deps.auth.resolvePrincipal(c.req.raw);
    if (principal === null) throw unauthenticated();
    const filter = parseTransactionListFilter(Object.fromEntries(new URL(c.req.url).searchParams));
    if (filter === null) throw badRequest("Invalid role or status filter");
    const paging = parsePagination(Object.fromEntries(new URL(c.req.url).searchParams));
    return c.json(await deps.service.listMine(principal, filter, paging));
  });

  app.get("/transactions/:publicReference", async (c) => {
    const principal = await deps.auth.resolvePrincipal(c.req.raw);
    if (principal === null) throw unauthenticated();
    const reference = parsePublicReference(c.req.param("publicReference"));
    if (reference === null) throw badRequest();
    try {
      return c.json(await deps.service.detail(principal, reference));
    } catch (error) {
      if (error instanceof AuthorizationError) throw notFound();
      throw error;
    }
  });

  app.get("/invites/:slug", async (c) => {
    // Safe-public by design: high-entropy capability slug, minimum fields.
    const slug = parseInviteSlug(c.req.param("slug"));
    if (slug === null) throw notFound();
    const preview = await deps.service.invitePreview(slug);
    if (preview === null) throw notFound();
    return c.json(preview);
  });

  return app;
}
