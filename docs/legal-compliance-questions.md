# DealSure — Legal & Compliance Questions

Prepared using the Prudence `legal-business` skill guidance. This is NOT
legal advice. These are open questions that require qualified counsel and/or
a licensed financial partner before production launch. Labels:
`LEGAL_REVIEW_REQUIRED`, `FINANCIAL_PARTNER_CONFIRMATION_REQUIRED`,
`PRODUCT_POLICY_DECISION`, `TECHNICAL_CONTROL`.

## Position statement

DealSure does not hold customer funds itself today; funds are held with a
payment partner abstraction (currently a **mock** provider). The product
copy deliberately avoids claiming to be a licensed escrow institution
(`SECURED_WORDING` in `config.ts`: "payment secured" / "protected payment" /
"funds secured with payment partner"). **This wording posture must be
maintained** — an ordinary gateway collection API or business bank account
does not automatically constitute legal escrow.

## Open questions

### Q1 — Escrow / custody classification
- Is the intended arrangement legal escrow in Nigeria (and any other target
  jurisdiction)? What licence or trustee structure is required?
- Label: `FINANCIAL_PARTNER_CONFIRMATION_REQUIRED`, `LEGAL_REVIEW_REQUIRED`
- Owner: financial partner + counsel. Product copy must stay "protected
  payment" until confirmed otherwise.

### Q2 — Payment provider obligations
- Which licensed PSP/bank will hold funds between buyer payment and seller
  settlement? What are their rules for controlled payout, refunds,
  settlement windows, and chargebacks?
- Label: `FINANCIAL_PARTNER_CONFIRMATION_REQUIRED`
- Note: Paystack/Flutterwave do not automatically provide escrow; verify the
  actual product capability and agreement terms.

### Q3 — Nigeria data protection (NDPA/NDPR)
- Data inventory: profiles (PII), KYC documents, bank account numbers,
  evidence uploads, audit logs. Need lawful bases, privacy policy, data
  processing agreements, retention/deletion schedule, breach-notification
  process.
- Label: `LEGAL_REVIEW_REQUIRED`

### Q4 — Terms of service & consent
- Current `terms_versions` table exists and buyers accept version 1 at
  acceptance; there is no visible Terms/Privacy UI wiring in the audited
  code. Terms acceptance must be explicit, versioned, and evidenced
  (stored acceptances already modeled).
- Labels: `LEGAL_REVIEW_REQUIRED`, `PRODUCT_POLICY_DECISION`

### Q5 — Refund & dispute policy
- Dispute resolution rules (seller_settlement / buyer_refund / partial)
  need a published, enforceable policy consistent with consumer-protection
  rules; resolution times, evidence rules, and escalation path.
- Labels: `LEGAL_REVIEW_REQUIRED`, `PRODUCT_POLICY_DECISION`

### Q6 — KYC requirements
- When does KYC become mandatory (e.g., above transaction thresholds)?
  Which document types are accepted? What is stored and for how long?
- Labels: `LEGAL_REVIEW_REQUIRED`, `PRODUCT_POLICY_DECISION`

### Q7 — Fees & financial promotion
- Fee rules exist in `FEE_CONFIG` (currently zero-fee promo). Fee display,
  changing fees, and any financial-promotion compliance need review.
- Labels: `LEGAL_REVIEW_REQUIRED`, `PRODUCT_POLICY_DECISION`

### Q8 — Consumer protection / unfair terms
- Inspection windows (default 3 days), auto-acceptance on expiry, and
  cancellation rules must be fair and disclosed; auto-release on expiry
  without dispute should be validated against consumer rules.
- Labels: `LEGAL_REVIEW_REQUIRED`, `PRODUCT_POLICY_DECISION`

### Q9 — Record retention & auditability
- Retention periods for financial records, audit logs, KYC, and evidence;
  deletion and anonymisation processes; technical controls are ready
  (append-only ledger/audit) but policy is missing.
- Labels: `LEGAL_REVIEW_REQUIRED`, `TECHNICAL_CONTROL` (policy missing)

### Q10 — Cross-border & tax
- Cross-border transactions (NGN + other currencies), VAT/withholding on
  fees, and seller payout reporting.
- Label: `LEGAL_REVIEW_REQUIRED`

### Q11 — Email OTP delivery provider
- OTP emails are sent through the Freebuff `send_otp` endpoint. Confirm
  data-processing terms for sending PII (email) to that processor.
- Labels: `LEGAL_REVIEW_REQUIRED`, `TECHNICAL_CONTROL`

## Controls already in the code (technical)

- Money as integer minor units; no floats.
- Append-only `audit_logs` and `ledger_entries`; status history preserved.
- Configurable wording (never "escrow").
- Versioned terms acceptance model.
- Private evidence storage design in target; size/MIME validation planned.

## Process

- Every item above stays OPEN until answered by counsel / financial partner
  and recorded back into this file with a date and owner.
- Do not represent any AI-generated compliance guidance as legal advice.
- Do not state DealSure is authorized to operate escrow without verified
  legal/financial confirmation.