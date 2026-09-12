# Current State Gap Analysis — Phase 7 Financial Hardening

> Phase 7 — TASK 2 deliverable
> Checkpoint: `adb517b` (Phase 6 draft hardening complete)
> Date: 2026-09-12

---

## 1. What Exists (Verified)

### 1.1 Turso Layer (Read + Draft Writes)
| Component | Status | Location |
|-----------|--------|----------|
| Transaction reads | ✅ Working | `server/repositories/TursoTransactionRepository.ts` |
| Draft create (atomic batch) | ✅ Working | `TursoTransactionRepository.createDraft` |
| Draft edit (optimistic concurrency) | ✅ Working | `TursoTransactionRepository.editDraft` |
| Draft list (per-owner) | ✅ Working | `TursoTransactionRepository.listDrafts` |
| Draft service | ✅ Working | `server/services/TransactionDraftService.ts` |
| Version column (013) | ✅ Migration applied | `server/db/migrations/013_draft_version.sql` |
| Draft routes (POST/PATCH) | ✅ Working | `server/api/routes/drafts.ts` |
| Write mode gate | ✅ Working | `server/auth/writeModes.ts` |
| All other writes | 🚫 `NOT_IMPLEMENTED` | `TursoTransactionRepository` stubs |

### 1.2 Convex Layer (All Financial Writes)
| Mutation | Status | Auth | Idempotent | Issues |
|----------|--------|------|-----------|--------|
| `transactions.create` | ✅ | Non-guest | ❌ | No delivery fee >= 0 check |
| `transactions.publish` | ✅ | Seller | N/A | No items/media check |
| `transactions.acceptTerms` | ✅ | Buyer | N/A | Race-safe via atomic patch |
| `transactions.cancel` | ✅ | Participant | N/A | RELEASE_PENDING gap |
| `transactions.markReady` | ✅ | Seller | N/A | — |
| `requestPayment` | ✅ | Buyer | ✅ (idempotency key) | — |
| `confirmPayment` | ⚠️ Mock | Buyer | ✅ (status check) | **P0: Buyer confirms own payment** |
| `initiateSettlement` | ✅ | Buyer | ❌ | No CAS/locking |
| `processRefund` | ✅ | Staff | ❌ | No refund cap |
| `deliverItem` | ✅ | Seller | N/A | — |
| `approveReturn` | ✅ | Buyer | N/A | — |
| `handleDeliveryOtp` | ✅ | Buyer | N/A | — |
| `submitDispute` | ✅ | Buyer/Seller | ❌ | — |
| `resolveDispute` | ✅ | Staff | ❌ | No cumulative refund check |

### 1.3 Database Constraints (Supabase Migrations)
| Constraint Type | Coverage | Gap |
|----------------|----------|-----|
| Amount CHECK constraints | ✅ All financial tables | — |
| Status CHECK constraints | ✅ All financial tables | — |
| UNIQUE constraints | ✅ Idempotency keys, references | — |
| Partial unique indexes | ✅ One PAID settlement, one OPEN dispute | — |
| Append-only triggers | ✅ 6 tables × 2 triggers = 12 triggers | — |
| Foreign keys | ✅ All financial tables | — |
| Ledger XOR debit/credit | ✅ DB-level CHECK | — |

### 1.4 API Error Handling
| Component | Status | Notes |
|-----------|--------|-------|
| `MoneyError` → HTTP 400 | ✅ | Via `error.name === "MoneyError"` |
| `DraftServiceError` codes | ✅ | Route-level catch with `.httpStatus` |
| SQLite error detection | ✅ | Regex on error message |
| Convex error mapping | 🚫 | All become HTTP 500 |

---

## 2. What's Missing (Phase 7 Requirements)

### 2.1 P0 — Critical Financial Correctness

| # | Gap | Current Behavior | Required Behavior | Files |
|---|-----|-----------------|-------------------|-------|
| 1 | **Buyer-triggered `confirmPayment`** | Buyer calls mutation to mark payment SECURED | Provider webhook or server-side verification only | `src/convex/payments.ts:87` |
| 2 | **No refund cap** | `partial_refund` accepts any positive `refundKobo` | `refundKobo ≤ totalKobo - SUM(prior refunds)` | `src/convex/disputes.ts:114` |
| 3 | **No cumulative refund tracking** | Multiple disputes can each trigger full refund | `SUM(all refunds for tx) ≤ totalKobo` | `src/convex/disputes.ts` |
| 4 | **Settlement race condition** | No CAS/locking between concurrent mutations | Optimistic lock or status-based CAS | `src/convex/settlement.ts:23` |

### 2.2 P1 — Important Safeguards

| # | Gap | Current Behavior | Required Behavior | Files |
|---|-----|-----------------|-------------------|-------|
| 5 | **Fee deduction not implemented** | Settlement pays `totalKobo` (full amount) | Settlement = `totalKobo - feeKobo`; refund proportional | `src/convex/settlement.ts` |
| 6 | **No append-only in Convex** | All ledger/audit records mutable in Convex | Application-level immutability checks | `src/convex/schema.ts` |
| 7 | **No unique constraints in Convex** | Double-settlement relies on status check only | Application-level uniqueness checks | `src/convex/*.ts` |
| 8 | **Convex errors all become HTTP 500** | Plain `new Error(...)` in all mutations | Typed errors with ApiErrorCode mapping | All Convex mutations |

### 2.3 P2 — Nice-to-Have Improvements

| # | Gap | Current Behavior | Required Behavior | Files |
|---|-----|-----------------|-------------------|-------|
| 9 | **Negative delivery fee** | `deliveryFeeKobo` not validated in Convex | `deliveryFeeKobo >= 0` check | `src/convex/transactions.ts:214` |
| 10 | **No automatic expiry** | Transactions in PENDING_BUYER_ACCEPTANCE/AWAITING_PAYMENT can stay forever | Expiry cron or TTL check | `src/convex/transactions.ts` |
| 11 | **RELEASE_PENDING can be cancelled** | Race with settlement | Block cancel when settlement in progress | `src/convex/transactions.ts:369` |
| 12 | **Bank account fallback to dummy** | `"0000000000"` used when no bank account | Fail loudly or require bank account | `src/convex/settlement.ts` |

---

## 3. Phase 7 Task Mapping

| Task | Gap(s) Addressed | Priority | Est. Complexity |
|------|-----------------|----------|----------------|
| TASK 3: Refund cap | #2, #3 | P0 | Medium |
| TASK 4: Settlement race safety | #4 | P0 | Medium |
| TASK 5: Remove mock `confirmPayment` | #1 | P0 | High |
| TASK 6: Fee deduction | #5 | P1 | Medium |
| TASK 7: Application-level idempotency | #7 | P1 | Medium |
| TASK 8: Append-only in Convex | #6 | P1 | Low |
| TASK 9: Typed Convex errors | #8 | P1 | Medium |
| TASK 10: Delivery fee validation | #9 | P2 | Low |
| TASK 11: Transaction expiry | #10 | P2 | Medium |
| TASK 12: Adversarial test suite | All | P0 | High |
| TASK 13: Financial correctness tests | All | P0 | High |
| TASK 14: State machine documentation | — | Done (this file) | — |
| TASK 15: Invariant documentation | — | Done (prev file) | — |
| TASK 16: Integration tests | #1-#4 | P0 | High |
| TASK 17: Error mapping tests | #8 | P1 | Medium |
| TASK 18: Final review + sign-off | All | — | Low |

---

## 4. Test Suite Status

| Suite | Tests | Status |
|-------|-------|--------|
| `server/api/api.test.ts` | 38 | ✅ All passing |
| `server/api/apiAuth.test.ts` | 47 | ✅ All passing |
| `server/api/drafts.test.ts` | 49 | ✅ All passing |
| `server/api/parity.test.ts` | 16 | ✅ 16/16 parity |
| `server/db/migrate.test.ts` | 3 | ✅ All passing |
| `server/api/schemaValidation.test.ts` | 20 | ✅ All passing |
| `server/services/health.test.ts` | 24 | ✅ All passing |
| `server/services/TransactionDraftService.test.ts` | 28 | ✅ All passing |
| `server/repositories/TursoTransactionRepository.test.ts` | 40 | ✅ All passing |
| `server/api/routes/drafts.test.ts` | 12 | ✅ All passing |
| **Total** | **207** | **✅ All passing** |

### Tests to Add (Phase 7)
| Suite | Purpose | Count (est.) |
|-------|---------|-------------|
| `server/financial/refundCap.test.ts` | Refund cap enforcement | ~8 |
| `server/financial/settlementRace.test.ts` | Settlement race conditions | ~6 |
| `server/financial/feeDeduction.test.ts` | Fee deduction correctness | ~5 |
| `server/financial/financialCorrectness.test.ts` | Adversarial/property tests | ~15 |
| `server/financial/errorMapping.test.ts` | Convex→API error mapping | ~10 |

---

## 5. Migration Inventory

| # | Name | Purpose | Financial? |
|---|------|---------|-----------|
| 001 | profiles | User profiles | ❌ |
| 002 | transactions | Transaction lifecycle | ✅ |
| 003 | payments | Payment intents + events | ✅ |
| 004 | delivery | Delivery + OTP | ✅ |
| 005 | transactions_rls | RLS policies | ✅ |
| 006 | disputes | Dispute lifecycle | ✅ |
| 007 | ledger | Double-entry accounting | ✅ |
| 008 | settlements_refunds | Settlement + refund records | ✅ |
| 009 | notifications_risk_audit | Notifications, risk, audit | ✅ |
| 010 | terms_kyc | Terms, KYC, bank accounts | ✅ |
| 011 | append_only_guards | 12 append-only triggers | ✅ |
| 012 | dispute_metadata | Dispute additional fields | ✅ |
| 013 | draft_version | Optimistic concurrency for drafts | ✅ |

**Next migration:** 014

---

## 6. Architecture Constraints

1. **Convex is authoritative for ALL writes** — Turso is read replica for API layer
2. **No floating-point for money** — integer minor units (kobo) only
3. **Dual-authority**: Convex mutations handle financial ops; Turso handles reads + draft writes
4. **Supabase migrations define DB-level guards** — RLS, triggers, CHECK constraints
5. **Convex schema has no DB-level constraints** — application-level enforcement required
6. **`DenyAllAuth` is not production-ready** — write mode gated to `draft-development`
7. **Live deployment blocked** — no Convex production auth, no Turso token, no MFA
