# DealSure — Transaction State Machine

Statuses are defined as a typed const enum in `src/convex/transactions/state.ts`
and all transitions are validated server-side against an explicit transition map.
There are no arbitrary status strings scattered through the code.

## States

| State | Meaning |
| --- | --- |
| `DRAFT` | Seller is authoring the transaction. Not yet shareable. |
| `PENDING_BUYER_ACCEPTANCE` | Seller published; shareable link live; buyer must accept terms. |
| `AWAITING_PAYMENT` | Buyer accepted terms; ready to pay. |
| `PAYMENT_PROCESSING` | Buyer initiated payment; awaiting provider confirmation. |
| `PAYMENT_SECURED` | Payment verified server-side. Funds secured with partner. |
| `READY_FOR_DELIVERY` | Seller acknowledged; may dispatch. |
| `DISPATCHED` | Seller shipped; delivery OTP generated. |
| `DELIVERED_PENDING_INSPECTION` | Buyer confirmed receipt; inspection window running. |
| `ACCEPTED` | Buyer accepted the item (or auto-accepted on expiry). |
| `RELEASE_PENDING` | Release conditions met; settlement in flight with partner. |
| `SETTLED` | Settlement complete; funds released to seller. |
| `DISPUTED` | Dispute open; settlement blocked. |
| `REFUND_PENDING` | Admin resolved refund; refund in flight with partner. |
| `REFUNDED` | Refund complete. |
| `CANCELLED` | Cancelled before payment. |
| `EXPIRED` | Timeout without required buyer/seller action. |

## Allowed transitions (server-enforced)

```
DRAFT                      -> PENDING_BUYER_ACCEPTANCE | CANCELLED
PENDING_BUYER_ACCEPTANCE   -> AWAITING_PAYMENT | CANCELLED | EXPIRED
AWAITING_PAYMENT           -> PAYMENT_PROCESSING | CANCELLED | EXPIRED
PAYMENT_PROCESSING         -> PAYMENT_SECURED | CANCELLED (refund-needed)
PAYMENT_SECURED            -> READY_FOR_DELIVERY | DISPATCHED | DISPUTED
READY_FOR_DELIVERY         -> DISPATCHED | DISPUTED
DISPATCHED                 -> DELIVERED_PENDING_INSPECTION | DISPUTED
DELIVERED_PENDING_INSPECTION -> ACCEPTED | DISPUTED
ACCEPTED                   -> RELEASE_PENDING (release eligible)
RELEASE_PENDING            -> SETTLED
DISPUTED                   -> RELEASE_PENDING (seller wins) | REFUND_PENDING (buyer wins)
REFUND_PENDING             -> REFUNDED
```

Invalid transitions throw a typed `StateTransitionError` server-side and are never
applied.

## Guards

- Settlement only proceeds when status is `ACCEPTED`/`RELEASE_PENDING`, payment
  was server-verified, and no dispute is open.
- A `DISPUTED` transaction is settlement-blocked: `settleIfEligible` refuses it.
- Buyer can only interact with transactions they participate in (or the seller).
- A `CANCELLED`/`EXPIRED`/`SETTLED`/`REFUNDED` transaction cannot be reactivated.
- Automated release is driven by the `inspectionAutoRelease` cron, never a client timer.

## Audit

Every successful transition writes a row to `transaction_status_history` and an
`audit_log` entry recording actor, timestamp, previous status, new status and reason.