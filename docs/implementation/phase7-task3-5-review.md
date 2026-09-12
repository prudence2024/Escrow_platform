# Phase 7 — TASK 3-5 Correctness Review

> Checkpoint: dcb99b5
> Reviewer: automated analysis of disputes.ts, settlement.ts, payments.ts, lib.ts

---

## REVIEW A — REFUND CAP

### Formula

```
remainingRefundable = totalKobo − Σ(paid refunds) − Σ(paid settlements)
```

### What `totalKobo` means

`totalKobo` is the **gross transaction amount** (`tx.totalKobo`), which equals:
`amountKobo + deliveryFeeKobo + platformFeeKobo`

This is also the amount the buyer pays (payment intent `amountKobo = tx.totalKobo`).

### Current correctness (zero-fee promo mode)

With `FEE_CONFIG.promoZeroFee = true`, `feeKobo = 0`, so:
- `totalKobo = amountKobo + deliveryFeeKobo` (no platform fee)
- `payment intent amountKobo = totalKobo`
- Settlement pays `totalKobo`
- Refund pays up to `totalKobo`

The invariant `settledMinor + refundedMinor ≤ totalKobo` holds correctly.

### Interaction with fees

| Fee type | Current value | Effect on refund cap |
|----------|--------------|---------------------|
| Platform fee (`feeKobo`) | 0 (promo) | None — not deducted from settlement or refund |
| Delivery fee | Stored on tx | Included in `totalKobo` — buyer pays it, seller receives it |
| Provider fee | Not modeled | Not applicable |

### TASK 6 dependency

When TASK 6 implements fee deduction:
- Settlement will pay `totalKobo − feeKobo` (not full `totalKobo`)
- Refund should be capped at what was actually received in custody
- The formula must change to: `remainingRefundable = (totalKobo − feeKobo) − Σ(paid refunds) − Σ(paid settlements)`
- **Or equivalently**: track `grossPaidMinor` separately and use that as the cap base

**Recommendation**: Do NOT prematurely refactor the formula now. Document the dependency. When TASK 6 lands, update `remainingRefundable` to accept `feeKobo` parameter and adjust the base.

### Verdict

**Correct for current zero-fee state.** Formula must be updated when TASK 6 introduces fee accounting. The dependency is documented here.

---

## REVIEW B — SETTLEMENT CAS ATOMICITY

### Current implementation

```
releaseTx():
  1. Read tx (line 24)
  2. Check status ∈ {ACCEPTED, RELEASE_PENDING} (line 31)
  3. Check no OPEN dispute (line 38-43)
  4. CAS re-read: freshTx = db.get(tx._id) (line 47)
  5. Compare freshTx.status === statusAtRead (line 49)
  6. Check secured intent exists (line 56-61)
  7. performTransition(tx → RELEASE_PENDING) (line 64) [uses stale tx]
  8. provider.requestSettlement() (line 74)
  9. Insert settlement record (line 81)
  10. performTransition(tx → SETTLED) (line 101) [uses stale tx]
```

### Is this genuinely atomic?

**Yes, but not because of the CAS re-read.** The CAS re-read (step 4-5) is technically redundant. The actual atomicity guarantee comes from **Convex's per-document mutation serialization**:

1. Convex executes mutations sequentially per document. Two concurrent mutations on the same transaction document cannot interleave.
2. `performTransition` (lib.ts:165-202) checks `ALLOWED_TRANSITIONS[from]?.has(to)` before patching. This is a state-machine gate.
3. If mutation A transitions ACCEPTED→RELEASE_PENDING, mutation B (running after A due to serialization) will read RELEASE_PENDING and find RELEASE_PENDING→SETTLED is allowed, but only if A completed to SETTLED first, in which case B reads SETTLED and the `if (tx.status === STATUSES.SETTLED)` early-return fires.

### Concrete scenario: two concurrent settlement attempts

```
Mutation A (accept → releaseTx):
  reads tx.status = ACCEPTED
  performTransition: ACCEPTED → RELEASE_PENDING ✓
  performTransition: RELEASE_PENDING → SETTLED ✓

Mutation B (concurrent releaseTx):
  reads tx.status = SETTLED (after A completes)
  early return: { alreadyProcessed: true } ✓
```

Convex serializes A before B. B sees A's writes. No double settlement possible.

### Concrete scenario: settlement vs dispute

```
Mutation A (releaseTx):
  reads tx.status = ACCEPTED
  checks no OPEN dispute ✓
  CAS re-read: still ACCEPTED ✓
  performTransition: ACCEPTED → RELEASE_PENDING ✓

Mutation B (openDispute):
  reads tx.status = RELEASE_PENDING (after A)
  performTransition: RELEASE_PENDING → DISPUTED ✓
  sets disputeBlocked = true

Mutation A continues:
  requestSettlement() — but dispute now exists
  A inserts settlement record anyway
  performTransition: RELEASE_PENDING → SETTLED
```

**This is safe** because Convex serializes A before B or B before A:
- If A runs first: settlement completes, then dispute opens on SETTLED tx (but `open` checks `isTerminal` and rejects)
- If B runs first: dispute opens, then A checks `if (openDispute)` and throws

### The CAS re-read provides defense-in-depth

While technically redundant under Convex serialization, the CAS re-read:
1. Documents the intent clearly
2. Provides a safety net if Convex's execution model changes
3. Catches logical errors in multi-document operations

### Verdict

**Atomicity is guaranteed by Convex's per-document serialization + performTransition state machine.** The CAS re-read is defense-in-depth. No fix required.

---

## REVIEW C — PAYMENT AUTHORITY

### Current state

- `confirmPayment` gated to `requireStaff(ctx)` — only admin/ops
- Uses `providerAPI.handleWebhook()` to verify the provider response
- Captures `staff._id` in audit trail
- No `reason` field in args or audit metadata

### Issues found

1. **No explicit `reason` field**: Staff manual confirmation should document why it's being done manually (vs. automatic provider webhook). Add `reason` to args and audit metadata.

2. **No source distinction in audit**: The audit action is `PAYMENT_VERIFIED` regardless of whether it came from a provider webhook or staff manual trigger. The `meta` field captures `provider` but not the source.

3. **Staff manual confirmation as default production path**: The current implementation is staff-only, which is correct for sandbox. In production, the primary path MUST be a provider-signed webhook. The staff path should be explicitly labeled as "manual override" in documentation and audit.

### Fixes applied

1. Add `reason` arg to `confirmPayment` (required for audit trail)
2. Include `source: "staff_manual_override"` in audit metadata
3. Update security documentation

### Verdict

**Buyer access is forbidden.** Staff path needs `reason` field and explicit audit source tagging. Fixes applied below.
