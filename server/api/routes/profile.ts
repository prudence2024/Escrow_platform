/**
 * API routes: profile reads (Phase 4, §22).
 * Own private profile vs public seller card — sensitive fields never enter
 * the public DTO.
 */
import { Hono } from "hono";
import type { ApiEnv } from "../middleware.js";
import type { ApiAuth } from "../../auth/apiAuth.js";
import type { UserQueryService } from "../../services/UserQueryService.js";
import { badRequest, notFound, unauthenticated } from "../errors.js";
import { parseProfileId } from "../validation.js";

export interface ProfileRouteDeps {
  auth: ApiAuth;
  service: UserQueryService;
}

export function profileRoutes(deps: ProfileRouteDeps) {
  const app = new Hono<ApiEnv>();

  app.get("/profile/me", async (c) => {
    const principal = await deps.auth.resolvePrincipal(c.req.raw);
    if (principal === null) throw unauthenticated();
    const profile = await deps.service.myProfile(principal);
    if (profile === null) throw notFound();
    return c.json(profile);
  });

  app.get("/sellers/:profileId", async (c) => {
    const principal = await deps.auth.resolvePrincipal(c.req.raw);
    if (principal === null) throw unauthenticated();
    const profileId = parseProfileId(c.req.param("profileId"));
    if (profileId === null) throw badRequest();
    const seller = await deps.service.publicSeller(principal, profileId);
    if (seller === null) throw notFound();
    return c.json(seller);
  });

  return app;
}
