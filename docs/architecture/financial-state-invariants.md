# Financial State Invariants

> Phase 7 — TASK 2 deliverable
> Source-of-truth: Convex mutations (`src/convex/`) + Supabase migrations (`server/db/migrations/`)

---

## 1. Transaction Amount Invariants

### 1.1 Amount Range
- `amountMinor >= MIN_TRANSACTION_MINOR` (₦50 = 5 000 kobo)
- `amountMinor <= MAX_TRANSACTION_MINOR` (₦10 000 000 = 1 000 000 000 kobo)
- Enforced: Convex `create` mutation + Supabase CHECK constraint (migration 002)

### 1.2 Delivery Fee
- `deliveryFeeMinor >= 0` (Supabase CHECK)
- Convex `create` mutation validates `deliveryFeeKobo >= 0` ✅ (Phase 7)
- `totalMinor = amountMinor + deliveryFeeMinor + platformFeeMinor`
- `totalMinor >= MIN_TRANSACTION_MINOR` (enforced by `assertTransactionMinorAmount` on computed total)

### 1.3 Fee Handling
- `feeKobo` is calculated at creation via `feeFor(amountKobo)` — currently returns 0 (promo mode)
- Fee snapshot is frozen on the transaction record
- Fee deduction implemented: settlement = `totalKobo - feeKobo`, refund cap = `totalKobo - feeKobo` ✅ (Phase 7)
- Ledger entry for fee revenue (debit `2000`, credit `4000`) when `feeKobo > 0` ✅ (Phase 7)

### 1.4 Money Types
- All monetary values stored as integer minor units (kobo) — no floating-point
- `MoneyError` thrown for invalid values; mapped to HTTP 400 via `error.name === "MoneyError"`
- `assertMinorAmount`: non-negative integer, safe integer range
- `assertPositiveMinorAmount`: strictly positive integer
- `assertTransactionMinorAmount`: within [5 000, 1 000 000 000]

---

## 2. Payment Invariants

### 2.1 Payment Intent Lifecycle
| Status | Meaning |
|--------|---------|
| `PENDING` | Created, provider call in progress |
| `SECURED` | Provider confirmed, funds captured |
| `REFUNDED` | Full or partial refund processed |
| `FAILED` | Provider rejected |
| `CANCELLED` | Intent cancelled before capture |

### 2.2 Amount Verification
- Payment intent `amountMinor` must equal `tx.totalKobo` (server-side, not user-supplied)
- Provider confirmation must return `capturedAmountKobo === tx.totalKobo` (checked in `confirmPayment`)
- **Gap:** No verification that provider returns amount ≤ tx.totalKobo for partial captures

### 2.3 Idempotency
- `idempotencyKey` scoped per `(transaction_id, idempotency_key)` in DB
- Convex `requestPayment` queries `by_idempotency` index before insert
- Safe under Convex's per-mutation serialization (single-writer model)
- `confirmPayment` requires staff role and `reason` arg for audit trail ✅ (Phase 7)

### 2.4 Event Sourcing
- `payment_events` table is append-only (DB trigger prevents UPDATE/DELETE)
- `providerEventId` used for deduplication via UNIQUE `(payment_intent_id, provider_event_id)`
- **Gap:** Convex `payment_events` insert has no idempotency check — rapid calls could duplicate events

---

## 3. Settlement Invariants

### 3.1 Settlement Amount
- Settlement pays `sellerSettlementKobo = tx.totalKobo - feeKobo` (fee deducted) ✅ (Phase 7)
- Settlement amount verified ≤ secured payment intent amount ✅ (Phase 7)

### 3.2 Double-Settlement Prevention
- DB partial unique index: at most ONE `PAID` settlement per `transaction_id`
- Convex: checks `tx.status === SETTLED` before processing (idempotent return)
- **Gap:** Convex has no unique constraint equivalent — relies on status check only

### 3.3 Settlement Eligibility
- Required: `tx.status ∈ {ACCEPTED, RELEASE_PENDING}`
- Required: No OPEN dispute exists
- Required: `disputeBlocked === false`
- Required: A SECURED payment intent exists
- Required: Transaction has a bank account (falls back to dummy `0000000000`)

### 3.4 Bank Account Fallback
- If seller has no bank account, settlement uses dummy `"0000000000"`
- **Gap:** This could silently fail in production with real providers

---

## 4. Refund Invariants

### 4.1 Refund Amount
- `buyer_refund`: `tx.totalKobo` (full amount), capped at `remainingRefundable`
- `partial_refund`: user-supplied `refundKobo` (must be > 0), capped at `remainingRefundable`
- Refund cap enforced: `remainingRefundable = totalKobo - feeKobo - Σ(paid refunds) - Σ(paid settlements)` ✅ (Phase 7)
- Fee deduction applied: refund cap excludes non-refundable platform fee ✅ (Phase 7)

### 4.2 Double-Refund Prevention
- DB: UNIQUE `(transaction_id, idempotency_key)` on refunds table
- Idempotency key support in `resolveDispute` ✅ (Phase 7)
- Aggregate check: `SUM(refund amounts) ≤ remainingRefundable` ✅ (Phase 7)
- Check that refund + settlement ≤ totalKobo - feeKobo ✅ (Phase 7)

### 4.3 Refund Approval
- `buyer_refund` and `partial_refund` require MFA (`requireStepUp`)
- `seller_settlement` resolution does **not** require MFA

---

## 5. Ledger Double-Entry Invariants

### 5.1 Entry Structure
- Every ledger transaction has exactly one debit entry and one credit entry
- `debit.amountKobo === credit.amountKobo` (enforced by `postDoubleEntry`)
- DB CHECK: `((debit_minor = 0) <> (credit_minor = 0))` — XOR enforcement
- **Gap:** Convex schema allows both debit and credit to be nonzero — no XOR check

### 5.2 Account Codes
| Code | Name | Type |
|------|------|------|
| `1000` | Custody Asset | ASSET |
| `2000` | Buyer Payable | LIABILITY |
| `4000` | Fee Revenue | REVENUE |

### 5.3 Journal Entries by Event
| Event | Debit | Credit | Amount |
|-------|-------|--------|--------|
| Payment secured | 1000 (Custody Asset) | 2000 (Buyer Payable) | `tx.totalKobo` |
| Settlement | 2000 (Buyer Payable) | 1000 (Custody Asset) | `tx.totalKobo` |
| Refund | 2000 (Buyer Payable) | 1000 (Custody Asset) | `refundAmount` |

### 5.4 Append-Only Enforcement
- DB: Triggers on `ledger_transactions` and `ledger_entries` prevent UPDATE/DELETE
- **Gap:** Convex has no equivalent — all ledger records are mutable

---

## 6. Concurrency & Race Condition Invariants

### 6.1 Optimistic Concurrency
- Draft transactions use `version` column (migration 013)
- `updateDraft` checks `expectedVersion === tx.version` before patching
- Version conflict returns HTTP 409 `VERSION_CONFLICT`

### 6.2 Convex Serialization
- Convex mutations are serialized per document — no two mutations write the same document concurrently
- Cross-document operations (e.g., insert intent + update transaction) are **not** atomic
- Settlement race condition: CAS freshness check in `releaseTx` and `resolveDispute` ✅ (Phase 7)
- Convex per-document serialization is the actual atomicity guarantee; CAS is defense-in-depth ✅

### 6.3 State Machine Enforcement
- `performTransition()` checks `ALLOWED_TRANSITIONS` before patching
- Invalid transitions throw `StateTransitionError`
- First-writer-wins for concurrent `acceptTerms` calls (only first succeeds)

---

## 7. Authorization Invariants

### 7.1 Role-Based Access
| Operation | Required Role |
|-----------|--------------|
| Create transaction | Any authenticated non-guest |
| Publish draft | Seller only |
| Accept terms | Any non-guest (not seller) |
| Request payment | Buyer only |
| Confirm payment | Staff only (admin/ops) ✅ (Phase 7) |
| Accept delivery | Buyer only |
| Dispatch | Seller only |
| Open dispute | Buyer or seller |
| Resolve dispute | Staff only |
| Freeze transaction | Staff only |
| Cancel | Seller, buyer, admin, ops |

### 7.2 Participant Verification
- Buyer identified by `tx.buyerId` (set atomically on `acceptTerms`)
- Seller identified by `tx.sellerId` (set at creation)
- **Gap:** `cancel` allows any participant from `transaction_participants` table, not just buyer/seller

---

## 8. Database-Level Constraints (Supabase Migrations)

### 8.1 Amount Constraints
| Table | Column | Constraint |
|-------|--------|-----------|
| `transactions` | `amount_minor` | `CHECK (>= 0)` |
| `transactions` | `delivery_fee_minor` | `CHECK (>= 0)` |
| `transactions` | `total_minor` | `CHECK (>= 0)` |
| `payment_intents` | `amount_minor` | `CHECK (> 0)` |
| `settlements` | `amount_minor` | `CHECK (> 0)` |
| `refunds` | `amount_minor` | `CHECK (> 0)` |
| `transaction_items` | `quantity` | `CHECK (> 0)` |
| `transaction_items` | `unit_amount_minor` | `CHECK (>= 0)` |

### 8.2 Status Constraints
| Table | Allowed Values |
|-------|---------------|
| `transactions.status` | 16 lifecycle values (DRAFT through EXPIRED) |
| `payment_intents.status` | PENDING, SECURED, REFUNDED, FAILED, CANCELLED |
| `settlements.status` | PENDING, PAID, FAILED |
| `refunds.status` | PENDING, PAID, FAILED |
| `disputes.status` | OPEN, UNDER_REVIEW, RESOLVED, REFUNDED, CLOSED |
| `risk_flags.severity` | LOW, MEDIUM, HIGH |
| `risk_flags.status` | OPEN, REVIEWED, CLEARED |

### 8.3 Unique Constraints
| Table | Columns | Type |
|-------|---------|------|
| `transactions` | `public_reference` | UNIQUE |
| `transactions` | `invite_slug` | UNIQUE |
| `transaction_participants` | `(transaction_id, profile_id)` | UNIQUE |
| `payment_intents` | `(transaction_id, idempotency_key)` | UNIQUE |
| `payment_events` | `(payment_intent_id, provider_event_id)` | UNIQUE |
| `settlements` | `provider_reference` | UNIQUE |
| `refunds` | `(transaction_id, idempotency_key)` | UNIQUE |
| `idempotency_keys` | `(scope, idempotency_key)` | UNIQUE |
| `bank_accounts` | `(profile_id, account_number)` | UNIQUE |
| `ledger_accounts` | `code` | UNIQUE |
| `ledger_transactions` | `ref_id` | UNIQUE |

### 8.4 Partial Unique Indexes
- `settlements_one_paid_per_tx`: At most ONE `PAID` settlement per `transaction_id`
- `disputes_one_open_per_tx`: At most ONE open/under_review dispute per `transaction_id`

### 8.5 Append-Only Tables (12 triggers)
| Table | Triggers |
|-------|----------|
| `ledger_transactions` | BEFORE UPDATE → ABORT, BEFORE DELETE → ABORT |
| `ledger_entries` | BEFORE UPDATE → ABORT, BEFORE DELETE → ABORT |
| `audit_logs` | BEFORE UPDATE → ABORT, BEFORE DELETE → ABORT |
| `payment_events` | BEFORE UPDATE → ABORT, BEFORE DELETE → ABORT |
| `transaction_status_history` | BEFORE UPDATE → ABORT, BEFORE DELETE → ABORT |
| `delivery_events` | BEFORE UPDATE → ABORT, BEFORE DELETE → ABORT |

---

## 9. Critical Gap Summary

| # | Gap | Severity | Location | Status |
|---|-----|----------|----------|--------|
| 1 | Buyer-triggered `confirmPayment` allows buyer to mark payment successful | **P0** | `src/convex/payments.ts:87` | ✅ Fixed (staff-only + reason) |
| 2 | No refund cap enforcement — partial refund amount unchecked | **P0** | `src/convex/disputes.ts:114` | ✅ Fixed (`remainingRefundable`) |
| 3 | No cumulative refund tracking — multiple disputes can over-refund | **P0** | `src/convex/disputes.ts` | ✅ Fixed (cap enforcement) |
| 4 | Settlement race condition — no CAS/locking in Convex mutations | **P1** | `src/convex/settlement.ts` | ✅ Fixed (CAS + serialization) |
| 5 | Fees calculated but never deducted from settlement/refund | **P1** | `src/convex/settlement.ts:23` | ✅ Fixed (fee-aware settlement) |
| 6 | No append-only enforcement in Convex — all history tables mutable | **P1** | Convex schema | ✅ Mitigated (`assertFinancialImmutability`) |
| 7 | No unique constraints in Convex — double-settlement relies on status check | **P1** | Convex schema | ✅ Mitigated (idempotency + CAS) |
| 8 | All Convex errors throw plain `Error` — become HTTP 500 | **P2** | All Convex mutations | ✅ Partial (FINANCIAL_ERRORS codes) |
| 9 | Negative `deliveryFeeKobo` not rejected in Convex `create` | **P2** | `src/convex/transactions.ts:214` | ✅ Fixed |
| 10 | No automatic transaction expiry | **P2** | No mutation triggers EXPIRED | ✅ Fixed (`expireOverdue` mutation) |
