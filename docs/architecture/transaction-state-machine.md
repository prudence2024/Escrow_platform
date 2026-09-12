# Transaction State Machine

> Phase 7 — TASK 2 deliverable
> Source: `src/convex/transactions/state.ts` ALLOWED_TRANSITIONS + `src/convex/lib.ts` performTransition()

---

## 1. State Definitions

```
DRAFT
PENDING_BUYER_ACCEPTANCE
AWAITING_PAYMENT
PAYMENT_PROCESSING
PAYMENT_SECURED
READY_FOR_DELIVERY
DISPATCHED
DELIVERED_PENDING_INSPECTION
ACCEPTED
RELEASE_PENDING
SETTLED               ← terminal
DISPUTED
REFUND_PENDING
REFUNDED              ← terminal
CANCELLED             ← terminal
EXPIRED               ← terminal
```

**16 states total. 4 terminal states.**

---

## 2. Allowed Transitions

```
DRAFT ──────────────────────► PENDING_BUYER_ACCEPTANCE
 │                              │
 │                              ├──► CANCELLED
 │                              ├──► EXPIRED
 │                              ▼
 │                           AWAITING_PAYMENT
 │                              │
 │                              ├──► PAYMENT_PROCESSING
 │                              ├──► CANCELLED
 │                              ├──► EXPIRED
 │                              ▼
 │                           PAYMENT_PROCESSING
 │                              │
 │                              ├──► PAYMENT_SECURED
 │                              ├──► CANCELLED
 │                              ▼
 │                           PAYMENT_SECURED
 │                              │
 │                              ├──► READY_FOR_DELIVERY
 │                              ├──► DISPATCHED
 │                              ├──► DISPUTED
 │                              ▼
 │                           READY_FOR_DELIVERY
 │                              │
 │                              ├──► DISPATCHED
 │                              ├──► DISPUTED
 │                              ▼
 │                           DISPATCHED
 │                              │
 │                              ├──► DELIVERED_PENDING_INSPECTION
 │                              ├──► DISPUTED
 │                              ▼
 │                           DELIVERED_PENDING_INSPECTION
 │                              │
 │                              ├──► ACCEPTED
 │                              ├──► DISPUTED
 │                              ▼
 │                           ACCEPTED
 │                              │
 │                              ├──► RELEASE_PENDING
 │                              ├──► DISPUTED
 │                              ▼
 │                           RELEASE_PENDING
 │                              │
 │                              ├──► SETTLED  ◄── terminal
 │                              ├──► DISPUTED
 │                              ├──► REFUND_PENDING
 │                              ▼
 │                           DISPUTED
 │                              │
 │                              ├──► RELEASE_PENDING (seller_settlement)
 │                              ├──► REFUND_PENDING (buyer_refund / partial_refund)
 │                              ▼
 │                           REFUND_PENDING
 │                              │
 │                              ├──► REFUNDED  ◄── terminal
 │
 └──► CANCELLED  ◄── terminal
```

---

## 3. Transition Table

| From | To | Trigger | Actor | Conditions |
|------|----|---------|-------|------------|
| `DRAFT` | `PENDING_BUYER_ACCEPTANCE` | `publish` | Seller | `sellerId === user._id` |
| `DRAFT` | `CANCELLED` | `cancel` | Seller/Buyer/Admin/Ops | Not terminal |
| `PENDING_BUYER_ACCEPTANCE` | `AWAITING_PAYMENT` | `acceptTerms` | Buyer | `buyerId` set atomically |
| `PENDING_BUYER_ACCEPTANCE` | `CANCELLED` | `cancel` | Seller/Buyer/Admin/Ops | Not terminal |
| `PENDING_BUYER_ACCEPTANCE` | `EXPIRED` | *(no mutation)* | — | **Gap: no expiry trigger** |
| `AWAITING_PAYMENT` | `PAYMENT_PROCESSING` | `requestPayment` | Buyer | `buyerId === user._id` |
| `AWAITING_PAYMENT` | `CANCELLED` | `cancel` | Seller/Buyer/Admin/Ops | Not terminal |
| `AWAITING_PAYMENT` | `EXPIRED` | *(no mutation)* | — | **Gap: no expiry trigger** |
| `PAYMENT_PROCESSING` | `PAYMENT_SECURED` | `confirmPayment` | Buyer | Provider confirms amount |
| `PAYMENT_PROCESSING` | `CANCELLED` | `cancel` | Ops only | Must void from ops |
| `PAYMENT_SECURED` | `READY_FOR_DELIVERY` | `markReady` | Seller | `sellerId === user._id` |
| `PAYMENT_SECURED` | `DISPATCHED` | `dispatch` | Seller | Generates OTP |
| `PAYMENT_SECURED` | `DISPUTED` | `openDispute` | Buyer/Seller | No open dispute |
| `READY_FOR_DELIVERY` | `DISPATCHED` | `dispatch` | Seller | Generates OTP |
| `READY_FOR_DELIVERY` | `DISPUTED` | `openDispute` | Buyer/Seller | No open dispute |
| `DISPATCHED` | `DELIVERED_PENDING_INSPECTION` | `confirmDelivery` | Buyer | OTP verified |
| `DISPATCHED` | `DISPUTED` | `openDispute` | Buyer/Seller | No open dispute |
| `DELIVERED_PENDING_INSPECTION` | `ACCEPTED` | `accept` | Buyer | `buyerId === user._id` |
| `DELIVERED_PENDING_INSPECTION` | `DISPUTED` | `openDispute` | Buyer/Seller | No open dispute |
| `ACCEPTED` | `RELEASE_PENDING` | `accept` | Buyer | Triggers settlement |
| `ACCEPTED` | `DISPUTED` | `openDispute` | Buyer/Seller | No open dispute |
| `RELEASE_PENDING` | `SETTLED` | `releaseTx` | System | No open dispute, secured intent |
| `RELEASE_PENDING` | `DISPUTED` | `openDispute` | Buyer/Seller | Interrupts settlement |
| `RELEASE_PENDING` | `REFUND_PENDING` | `resolveDispute` | Staff | buyer_refund/partial_refund |
| `RELEASE_PENDING` | `CANCELLED` | `cancel` | Seller/Buyer/Admin/Ops | **Gap: race with settlement** |
| `DISPUTED` | `RELEASE_PENDING` | `resolveDispute` | Staff | seller_settlement |
| `DISPUTED` | `REFUND_PENDING` | `resolveDispute` | Staff | buyer_refund/partial_refund |
| `REFUND_PENDING` | `REFUNDED` | `resolveDispute` | Staff | Provider confirms refund |

---

## 4. Terminal States

| State | Meaning | No outgoing transitions |
|-------|---------|------------------------|
| `SETTLED` | Funds released to seller | ✅ |
| `REFUNDED` | Funds returned to buyer | ✅ |
| `CANCELLED` | Transaction cancelled | ✅ |
| `EXPIRED` | Acceptance/payment window expired | ✅ |

---

## 5. Forbidden Transitions (Common Misconceptions)

| From | Forbidden To | Why |
|------|-------------|-----|
| `SETTLED` | Any | Terminal — no reversals |
| `REFUNDED` | Any | Terminal — no re-processing |
| `CANCELLED` | Any | Terminal — cannot uncancel |
| `EXPIRED` | Any | Terminal — cannot unexpire |
| `DRAFT` | `AWAITING_PAYMENT` | Must go through PENDING_BUYER_ACCEPTANCE |
| `PAYMENT_SECURED` | `CANCELLED` | Must use dispute/refund flow |
| `DISPATCHED` | `ACCEPTED` | Must go through DELIVERED_PENDING_INSPECTION |
| `DISPUTED` | `SETTLED` | Must go through RELEASE_PENDING first |
| `REFUND_PENDING` | `RELEASE_PENDING` | One-directional: refund path only |

---

## 6. Transition Enforcement

### 6.1 performTransition() — `src/convex/lib.ts:165-202`
- Checks `ALLOWED_TRANSITIONS[fromStatus]` includes `toStatus`
- Throws `StateTransitionError` if invalid
- Patches: `status`, `updatedAt`, `version++`, optional `extra` fields

### 6.2 isTerminal() — `src/convex/transactions/state.ts`
- Returns `true` for: `SETTLED`, `REFUNDED`, `CANCELLED`, `EXPIRED`
- Used by `cancel` to prevent cancelling terminal states

### 6.3 State History
- Every transition inserts into `transaction_status_history` (append-only in DB)
- Records: `fromStatus`, `toStatus`, `actorId`, `reason`, `meta`

---

## 7. State Machine Gaps

| # | Gap | Risk | Fix |
|---|-----|------|-----|
| 1 | `CANCELLED` allowed from `RELEASE_PENDING` | Race with settlement | Block cancel when RELEASE_PENDING + secured intent |
| 2 | No automatic `EXPIRED` transition | Transactions stuck indefinitely | Add expiry cron/mutation |
| 3 | `DISPUTED → RELEASE_PENDING` in `resolveDispute` runs before `releaseTx` | Stuck in RELEASE_PENDING if `releaseTx` fails | Atomic transition or retry |
| 4 | `freeze()` doesn't change status | Frozen tx can still be cancelled/disputed | Document as intentional (freeze ≠ status change) |
| 5 | No `REFUND_PENDING → CANCELLED` path | Refund can't be cancelled once initiated | Design decision — confirm |
