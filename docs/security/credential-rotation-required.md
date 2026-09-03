# DealSure — Credential Rotation Required

Status: **ROTATION REQUIRED — NOT RESOLVED UNTIL THE OWNER ROTATES THE KEY.**

## What happened

A Freebuff email-service API key (`send_otp`) used by Convex Auth's email OTP
provider was **hardcoded in source** at `src/convex/auth/emailOtp.ts` (header
`x-api-key`). The key value is redacted throughout this repository from
2026-09-03 onward.

## Exposure evidence

| Location | Detail |
| --- | --- |
| `src/convex/auth/emailOtp.ts` | Key hardcoded (fixed 2026-09-03 — now reads `process.env.VLY_EMAIL_API_KEY`) |
| Git history — commit `62a6a81` (`main`, "adding joshuas code to the repo") | Key present in the committed source |
| Git history — commit `36effa7` (branch `architecture/supabase-migration`, security review doc) | Key value appeared in `docs/security/pre-migration-security-review.md`; redacted in a follow-up commit |
| Working tree | No remaining occurrences of the key value (verified by search) |

The branch `architecture/supabase-migration` is **local and unpushed**;
`main` (`62a6a81`) is pushed to `origin`. Because the key exists in `main`'s
history, **history rewriting is not a sufficient remedy** — the credential
must be treated as compromised and rotated externally.

## Remediation status

- [x] Hardcoded key removed from `src/convex/auth/emailOtp.ts`; reads
      `process.env.VLY_EMAIL_API_KEY`; fails closed (clear error) when unset.
- [x] `.env.example` contains the `VLY_EMAIL_API_KEY=` placeholder only.
- [x] `.gitignore` excludes `.env*` (with `!.env.example`).
- [x] Repository searched: no remaining occurrences of the key value.
- [x] Git history searched: exposure confirmed in `62a6a81` and `36effa7`.
- [ ] **External rotation by account owner** — revoke/rotate the key in the
      Freebuff console (or equivalent admin surface) and set the new value as
      `VLY_EMAIL_API_KEY` in the Convex deployment environment. **Until this
      happens, treat the email-sending capability as compromised and do not
      consider the issue resolved.**

## After rotation

1. Set the new key in the Convex environment (server-side only).
2. Verify a sign-in OTP email still sends end-to-end.
3. Update `docs/security/security-review.md`: close C1 with the rotation
   date and the actor who performed it.

## Guidance

- Never paste real secret values into code, docs, logs, or AI prompts.
- Server secrets belong in environment/secrets managers only.
- When a secret touches a public repo, shared screen, or chat transcript,
  rotate it — do not merely delete the file (per the Prudence `security`
  skill: secrets & environment hygiene).