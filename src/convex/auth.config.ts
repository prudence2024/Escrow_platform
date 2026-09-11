import type { AuthConfig } from "convex/server";

// DealSure trusts exactly one identity issuer: itself (Convex Auth,
// self-issued JWTs validated via OIDC discovery). The former Freebuff
// federated `customJwt` bridge was retired in Phase 2 (Decision B):
// development-era infrastructure with no required production dependency in
// this repository (see docs/architecture/authentication-decision.md and
// docs/architecture/freebuff-jwt-retirement.md). Email OTP *delivery* still
// uses the Freebuff send_otp endpoint — that is transport, not identity
// trust, and is unchanged.

export default {
  providers: [
    // Standard Convex Auth provider for this project's own sign-in ("Get
    // Started" email/guest, see src/convex/auth.ts). The deployment
    // self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header) validated
    // via OIDC discovery at `${domain}/.well-known/openid-configuration`,
    // served by auth.addHttpRoutes() in convex/http.ts. Do NOT convert this
    // entry to `type: "customJwt"` — that path rejects tokens without a
    // `kid` header, so sign-in would silently never confirm and RequireAuth
    // would loop back to /auth forever.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
