# DealSure — Requirements Traceability

Maps product requirements (from the brief, README, and existing docs) →
current implementation (Convex) → target implementation (Supabase) →
status → test coverage. Updated as the migration proceeds.

Legend — Status: ✅ implemented · 🚧 partial · ⬜ planned · ❌ missing.
Coverage: ⬜ none · 🔲 planned · ✅ automated.

## Identity & onboarding

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R1 | Buyer registration / sign-in | Convex Auth email OTP + anonymous | Supabase Auth email OTP + anonymous upgrade | ✅ | ⬜ |
| R2 | Seller registration / sign-in | Same identity; `seller` role via `setRole` | Same identity; default `buyer`+`seller` roles | ✅ | ⬜ |
| R3 | Profile (name, phone, country, onboarding) | `profile.getOwnProfile/updateProfile`, `profiles` table | `profiles` + feature API module | ✅ | ⬜ |
| R4 | KYC submission/status | `profile.submitKyc`, `kyc_profiles` | `kyc_profiles` + staff approval flow | 🚧 (no upload/approval UI) | ⬜ |
| R5 | Bank account for payouts | `profile.addBankAccount` (10-digit NUBAN check, dup check) | `bank_accounts` + verification | ✅ | ⬜ |
| R6 | Terms acceptance (versioned) | `terms_versions` + `terms_acceptances` (v1 hard-coded in `acceptTerms`) | versioned terms UI + acceptance record | 🚧 (no terms UI) | ⬜ |
| R7 | Roles: buyer/seller/staff | `users.role` user/seller/admin/ops | `user_roles` DB-backed, MFA for staff | ✅ | ⬜ |

## Transactions

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R8 | Create transaction (title, description, category, items, media, amounts) | `transactions.create` (validates limits/category, computes fee/total server-side) | Edge Function `create` | ✅ | ⬜ |
| R9 | Protected shareable link | `slug` (96-bit entropy) + `publish` → `PENDING_BUYER_ACCEPTANCE`; `/t/:reference` | same; unguessable slug | ✅ | ⬜ |
| R10 | Buyer reviews agreed terms | `transactions.detail` view for invitee | RLS visibility + detail API | ✅ | ⬜ |
| R11 | Buyer accepts terms | `acceptTerms` → `AWAITING_PAYMENT`, participant + acceptance records | Edge Function + RLS | ✅ | ⬜ |
| R12 | Transaction history | `transaction_status_history` append-only | same + `internal.transition_transaction` | ✅ | ⬜ |
| R13 | Cancel / expiry | `cancel`; EXPIRED state exists (no expiry scheduler yet — cron only covers inspection) | cancel + expiry scheduler | 🚧 | ⬜ |
| R14 | State machine server-enforced | `ALLOWED_TRANSITIONS` + `performTransition` | DB transition function + CHECK | ✅ | 🔲 (planned unit + DB tests) |

## Payments

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R15 | Buyer initiates payment | `payments.requestPayment` (idempotency key, provider init) | Edge Function `request` | ✅ | ⬜ |
| R16 | Backend verifies payment | `payments.confirmPayment` simulates webhook server-side, amount check, event dedup | Edge Function `verify` (provider API/webhook only) | ✅ (mock) | 🔲 |
| R17 | Payment-secured status | `PAYMENT_SECURED` via transition + ledger post | same; internal `payment_events` | ✅ | ⬜ |
| R18 | Signed webhooks, idempotency, replay protection | event-id dedup + idempotency keys (mock) | `provider_webhook_events` UNIQUE + signature verify | 🚧 (real signature missing) | 🔲 |
| R19 | Provider abstraction | `PaymentProvider` + `MockPaymentProvider` | same interface; real adapters | ✅ | 🔲 |
| R20 | No client financial authority | browser never writes financial state (function-level) | internal schema, no grants, SECURITY DEFINER | ✅ | 🔲 |

## Delivery & inspection

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R21 | Seller dispatches; delivery evidence | `delivery.dispatch` + `delivery_events` | Edge Function + `delivery-evidence` storage | ✅ | ⬜ |
| R22 | Delivery OTP as supporting evidence | 6-digit OTP, 3h TTL, 5 attempts (plaintext + Math.random — see security H1/H2) | hashed CSPRNG OTP, atomic verify | 🚧 | 🔲 |
| R23 | Inspection window | `inspection_window_days` (3 default) → `DELIVERED_PENDING_INSPECTION` + deadline | same + DB CHECK window bounds | ✅ | ⬜ |
| R24 | Auto-release on expiry (server) | `jobs.inspectionAutoRelease` cron (5 min) | scheduled function, idempotent | ✅ | 🔲 |

## Disputes & settlement

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R25 | Buyer opens dispute | `disputes.open` (blocks settlement) | Edge Function + one-open-dispute guard | ✅ | ⬜ |
| R26 | Dispute evidence/messages | `disputes.addEvidence` (URL only), `disputes.message` | private storage + signed URLs | 🚧 (no upload path) | ⬜ |
| R27 | Admin review & resolution | `admin.disputeDetail`, `disputes.resolveDispute` (seller_settlement/buyer_refund/partial) | staff functions + MFA | ✅ | 🔲 |
| R28 | Refund (full/partial) | refund record + provider call + ledger | same; DB cap on partial ≤ total | 🚧 (H3 over-refund) | 🔲 |
| R29 | Settlement with release rules | `releaseTx` (secured payment, eligible status, no open dispute, not frozen) | `internal.release_tx` + single-PAID guard | ✅ | 🔲 |
| R30 | Ledger double-entry, append-only | `postDoubleEntry` balanced entries | internal ledger + balance trigger | ✅ | 🔲 (planned balance tests) |

## Operations & admin

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R31 | Admin dispute dashboard | `/admin`, `/admin/disputes/:id` (staff) | same + responsive fixes | ✅ | ⬜ |
| R32 | Notifications | `notifications` table + `lib.notify` + unread badge | server-side inserts + Realtime | ✅ | ⬜ |
| R33 | Auditability | `audit_logs` on every mutation | internal `audit_logs` + staff viewer | ✅ | ⬜ |
| R34 | Freeze / risk flags | `transactions.freeze` + `risk_flags` | staff function + audited | ✅ | ⬜ |
| R35 | Admin notes | `admin.addAdminNote` | staff function | ✅ | ⬜ |
| R36 | MFA for staff | ❌ none | TOTP required for staff | ❌ | 🔲 |

## Security / compliance

| # | Requirement | Current implementation | Target implementation | Status | Test coverage |
| --- | --- | --- | --- | --- | --- |
| R37 | RLS-equivalent isolation | function-level checks only | RLS + grants + negative tests | 🚧 (no RLS yet) | 🔲 |
| R38 | Money as integer minor units | `*_kobo` everywhere | `amount_minor bigint` + CHECKs | ✅ | 🔲 |
| R39 | No secret leakage | ❌ **hardcoded email API key (C1)**; no `.env.example` | env-only secrets; `.env.example` | 🚧 | 🔲 |
| R40 | Private evidence storage | ❌ no storage path | private buckets + signed URLs + validation | ❌ | 🔲 |
| R41 | Rate limiting | ❌ auth OTP only | Edge Function limits | ❌ | 🔲 |
| R42 | PWA installable, offline shell, no financial caching | manifest + sw.js (static only) | preserve; `no-store` financial routes | ✅ | ⬜ |
| R43 | Backup/restore | ❌ none | automated backups + tested restore + PITR | ❌ | 🔲 |
| R44 | Dependency hygiene | ❌ 8 audit vulns | re-audit per phase | 🚧 | — |

## Cross-cutting

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| R45 | Preserve working UI/flows | ✅ | frontend port is data-layer refactor, not redesign |
| R46 | Dual-run during migration | ⬜ | Convex stays until Phase 17 |
| R47 | Reconciliation before cutover | ⬜ | Phase 15; financial mismatch = failure |
| R48 | Automated tests (auth/RLS/state machine/payments/webhooks/ledger/delivery/OTP/disputes/refunds/settlement/admin/storage/migration/PWA/a11y/E2E) | ❌ | zero tests today; test plan per phase |