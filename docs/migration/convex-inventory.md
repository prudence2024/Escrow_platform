# DealSure — Convex Inventory

Baseline inventory of every Convex table and function (verified 2026-09-03,
commit `62a6a81`). This is the source of truth for the
`convex-to-postgres-map.md` mapping. **Convex stays in production until
Phase 17** — nothing here is removed yet.

Reading conventions: `Q` = query, `M` = mutation, `A` = action (node),
`IM` = internal mutation, `C` = cron.

---

## Identity

### users
- Fields: `name?`, `image?`, `email?`, `emailVerificationTime?`,
  `isAnonymous?`, `role?` (user|seller|admin|ops), `phone?`, `kycStatus?`,
  `onboarded?`
- Indexes: `email`
- Reads: `users.currentUser`, `transactions.detail` (seller/buyer lookups),
  `admin.searchUsers`
- Writes: auth provider writes, `profile.setRole` (patch role),
  `profile.updateProfile` (patch name), `profile.submitKyc` (patch kycStatus)
- Security: function-level only (no RLS in Convex)
- Migration priority: **1 — identity anchor for everything else**

### profiles
- Fields: `userId` → users, `fullName?`, `phone?`, `country?`, `onboarded?`,
  `termsVersionAccepted?`
- Indexes: `by_user`, `by_phone`
- Reads: `profile.getOwnProfile`
- Writes: `profile.updateProfile` (insert/patch)
- Migration priority: 1

### kyc_profiles
- Fields: `userId`, `status?`, `docType?`, `verifiedAt?`, `rejectedReason?`
- Indexes: `by_user`
- Reads: `profile.getOwnProfile`
- Writes: `profile.submitKyc`
- Migration priority: 4

### bank_accounts
- Fields: `userId`, `provider?`, `accountName`, `accountNumber`, `bankName`,
  `bankCode?`, `status?`, `isDefault?`
- Indexes: `by_user`, `by_accountNumber`
- Reads: `profile.getOwnProfile`, `settlement.releaseTx` (payout lookup)
- Writes: `profile.addBankAccount`
- Migration priority: 4

### terms_versions / terms_acceptances
- Fields: `version`, `content`, `effectiveAt` / `userId`, `version`,
  `acceptedAt`
- Indexes: `by_version` / `by_user`, `by_user_version`
- Reads: none wired in frontend queries (acceptance written by
  `transactions.acceptTerms`, version `1` hard-coded there)
- Migration priority: 4

---

## Transactions

### transactions
- Fields: `publicId` (dex_…), `slug` (share token), `status` (16-state enum),
  `sellerId`, `buyerId?`, `buyerEmail?`, `buyerPhone?`, `title`, `description`,
  `category`, `condition?`, `amountKobo`, `deliveryFeeKobo`, `totalKobo`,
  `feeKobo`, `feeChargedTo?`, `currency`, `agreedDeadlineAt?`,
  `inspectionWindowDays?`, `returnTerms?`, `disputeBlocked?`, `releasedAt?`,
  `createdAt`, `updatedAt`
- Indexes: `by_publicId`, `by_slug`, `by_seller`, `by_buyer`, `by_status`,
  `by_created`
- Reads: `transactions.myTransactions`, `transactions.detail`,
  `transactions.list` (staff), `settlement.releaseTx`, `delivery.*`,
  `disputes.*`, `admin.*`
- Writes: `transactions.create/publish/acceptTerms/cancel/freeze/markReady`,
  `payments.requestPayment/confirmPayment`, `settlement.accept`,
  `delivery.dispatch/confirmDelivery`, `disputes.open/resolveDispute`,
  `jobs.inspectionAutoRelease`, `lib.performTransition`
- Realtime deps: `TransactionDetail`, `Home`, `Transactions` pages (reactive)
- Migration priority: **2**

### transaction_items / transaction_media
- Fields: `transactionId`, `name`, `note?` / `transactionId`, `storageId?`,
  `url?`, `kind?`
- Reads: `transactions.detail`; Writes: `transactions.create`
- Migration priority: 2 (media → storage refs; no Convex storage in use)

### transaction_status_history
- Fields: `transactionId`, `actorId?`, `fromStatus?`, `toStatus`, `reason?`,
  `at`
- Reads: `transactions.detail`; Writes: `lib.performTransition`,
  `transactions.create`
- Migration priority: 2 — **must preserve complete history**

### transaction_participants
- Fields: `transactionId`, `userId`, `role`, `email?`, `acceptedAt?`
- Reads: `transactions.myTransactions`, `transactions.detail`; Writes:
  `transactions.acceptTerms`
- Migration priority: 2

---

## Payments

### payment_intents
- Fields: `transactionId`, `payerId`, `provider`, `providerIntentId?`,
  `providerEventId?`, `idempotencyKey`, `amountKobo`, `currency`, `status`
  (PENDING|SECURED|REFUNDED|FAILED|CANCELLED), `rawEvent?`, `createdAt`,
  `securedAt?`
- Indexes: `by_transaction`, `by_providerEventId`, `by_idempotency`,
  `by_payer`
- Reads: `transactions.detail`, `admin.listPayments`, `payments.*`,
  `settlement.releaseTx`, `disputes.resolveDispute`
- Writes: `payments.requestPayment`, `payments.confirmPayment`
- Realtime deps: `TransactionDetail` (payment status)
- Migration priority: **3**

### payment_events
- Fields: `paymentIntentId`, `providerEventId`, `type`, `raw?`, `receivedAt`
- Indexes: `by_intent`, `by_providerEventId`
- Reads: none via queries (only written); Writes: `payments.confirmPayment`
- Migration priority: 3 — **server-only table in target**

---

## Ledger

### ledger_accounts
- Fields: `code`, `name`, `type` (ASSET|LIABILITY|REVENUE|EXPENSE|EQUITY),
  `currency`
- Indexes: `by_code`
- Reads/Writes: `lib.postDoubleEntry` (ensureLedgerAccount)
- Migration priority: 5

### ledger_entries
- Fields: `accountId`, `transactionId?`, `entryRefId`, `debitKobo`,
  `creditKobo`, `memo`, `reversalOfEntryId?`, `createdAt`
- Indexes: `by_account`, `by_transaction`, `by_ref`
- Reads: none via queries; Writes: `lib.postDoubleEntry`
- Migration priority: 5 — **server-only, append-only**

---

## Delivery

### deliveries
- Fields: `transactionId`, `courierName?`, `trackingNumber?`,
  `carrierDetails?`, `dispatchedAt?`, `deliveredAt?`, `inspectionDeadlineAt?`,
  `status?`
- Indexes: `by_transaction`, `by_status`
- Reads: `transactions.detail`, `jobs.inspectionAutoRelease`; Writes:
  `delivery.dispatch`, `delivery.confirmDelivery`
- Realtime deps: `TransactionDetail` (delivery timeline)
- Migration priority: 3

### delivery_events
- Fields: `deliveryId`, `type`, `actorId?`, `at`, `note?`
- Reads: none via queries (detail reads deliveries only); Writes:
  `delivery.dispatch`, `delivery.confirmDelivery`
- Migration priority: 3

### delivery_otps
- Fields: `transactionId`, `deliveryId`, `codeHash` (**stores plaintext code
  today**), `expiresAt`, `attempts`, `consumedAt?`
- Reads: `delivery.confirmDelivery`; Writes: `delivery.dispatch`,
  `delivery.confirmDelivery`
- Migration priority: 3 — **hash codes before migration; do not carry
  plaintext into Postgres**

---

## Disputes

### disputes
- Fields: `transactionId`, `openedBy`, `reason`, `details?`, `status`
  (OPEN|RESOLVED|REFUNDED|CLOSED), `resolution?`, `resolutionNote?`,
  `resolvedBy?`, `resolvedAt?`, `createdAt`
- Indexes: `by_transaction`, `by_openedBy`, `by_status`
- Reads: `transactions.detail`, `admin.listDisputes`, `admin.disputeDetail`
- Writes: `disputes.open`, `disputes.resolveDispute`
- Realtime deps: `AdminDispute` (evidence thread)
- Migration priority: 3

### dispute_messages
- Fields: `disputeId`, `authorId`, `body`, `createdAt`
- Reads: `admin.disputeDetail`; Writes: `disputes.message`
- Migration priority: 3

### dispute_evidence
- Fields: `disputeId`, `uploaderId`, `url?`, `storageId?`, `createdAt`
- Reads: `admin.disputeDetail`; Writes: `disputes.addEvidence`
- Migration priority: 3 (→ private storage bucket)

---

## Settlement / refunds

### settlements
- Fields: `transactionId`, `recipientId`, `provider`, `providerRef?`,
  `amountKobo`, `status?` (PENDING|PAID|FAILED), `createdAt`, `completedAt?`
- Reads: `transactions.detail`; Writes: `settlement.releaseTx`
- Migration priority: **5 — server-only**

### refunds
- Fields: `transactionId`, `payerId`, `provider`, `providerRef?`,
  `amountKobo`, `reason?`, `status?`, `createdAt`, `completedAt?`
- Reads: `transactions.detail`; Writes: `disputes.resolveDispute`
- Migration priority: **5 — server-only**

---

## Notifications / ops

### notifications
- Fields: `userId`, `type`, `title`, `body?`, `transactionId?`, `readAt?`,
  `createdAt`
- Indexes: `by_user`, `by_user_unread`
- Reads: `notifications.myNotifications`, `notifications.unreadCount`; Writes:
  `notifications.markRead/markAllRead`, `lib.notify` (many callers)
- Realtime deps: AppShell unread badge (reactive)
- Migration priority: 4

### audit_logs
- Fields: `entityType`, `entityId`, `actorId?`, `action`, `from?`, `to?`,
  `reason?`, `meta?`, `at`
- Indexes: `by_entity`, `by_actor`, `by_action`, `by_at`
- Reads: `admin.auditLog`; Writes: `lib.audit` (every mutation)
- Migration priority: 5 — **server-only, append-only**

### risk_flags
- Fields: `transactionId?`, `userId?`, `flaggedBy?`, `reason`, `severity`,
  `status`, `createdAt`
- Reads: none via queries; Writes: `transactions.freeze`
- Migration priority: 5

### admin_notes
- Fields: `transactionId?`, `authorId`, `body`, `createdAt`
- Reads: none via queries; Writes: `admin.addAdminNote`
- Migration priority: 5

---

## Functions inventory (grouped)

| Module | Exports | Kind |
| --- | --- | --- |
| `transactions` | `myTransactions`, `detail`, `list` | Q |
| `transactions` | `create`, `publish`, `acceptTerms`, `cancel`, `freeze`, `markReady`, `settle` | M |
| `payments` | `requestPayment`, `confirmPayment`, `listProviders` | M |
| `settlement` | `accept`; internal `releaseTx` | M / helper |
| `delivery` | `dispatch`, `confirmDelivery` | M |
| `disputes` | `open`, `message`, `addEvidence`, `resolveDispute` | M |
| `admin` | `searchUsers`, `listDisputes`, `disputeDetail`, `auditLog`, `listPayments` | Q |
| `admin` | `addAdminNote` | M |
| `users` | `currentUser`, `getCurrentUser` | Q / helper |
| `profile` | `getOwnProfile` | Q |
| `profile` | `updateProfile`, `addBankAccount`, `submitKyc`, `setRole` | M |
| `notifications` | `myNotifications`, `unreadCount` | Q |
| `notifications` | `markRead`, `markAllRead` | M |
| `jobs` | `inspectionAutoRelease` | IM (cron) |
| `github` | `getRepoData`, `getUserInfo`, `getAuthenticatedUser` | A (node) |
| `lib` | `getActor`, `requireUser`, `requireStaff`, `requireAdmin`, `audit`, `notify`, `postDoubleEntry`, `performTransition`, id helpers | internal |

## Security rules today (Convex function-level)

- Every read/write path enforces: auth required (except landing/auth),
  participant/seller/buyer ownership, or staff.
- `transactions.detail` additionally allows authenticated pre-acceptance
  invitees to view (unguessable-slug share model).
- Admin queries (`admin.*`, `transactions.list`) require staff.
- There is **no RLS** (Convex model) — function code *is* the enforcement.
  The Postgres target must reproduce every one of these checks as RLS +
  grants so a direct Data-API call cannot bypass them.

## Realtime dependencies (Convex reactive → Supabase decision)

| Surface | Needs realtime? | Target |
| --- | --- | --- |
| Transaction detail (status/delivery/payment) | yes | Supabase Realtime (postgres_changes) |
| Notifications / unread badge | yes | Realtime or poll on focus (recommend Realtime channel) |
| Dispute thread / evidence | yes | Realtime for messages |
| Admin lists (deals/disputes/payments/audit) | no | plain queries + refetch |
| Profile / bank / KYC | no | plain queries |
| History / past transactions | no | plain queries |