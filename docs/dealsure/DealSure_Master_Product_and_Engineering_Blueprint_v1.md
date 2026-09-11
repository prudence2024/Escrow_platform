# DealSure Documentation Suite v1

**Research snapshot:** 2026-09-09

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

This suite is intended to be a practical company blueprint for the current AI-assisted build, future professional developers, security reviewers, product designers, operations staff and potential payment/compliance partners.

## How to use the suite

1. Start with Documents 01–04 to understand the market, opportunity and product philosophy.
2. Use Documents 05–08 as the product source of truth.
3. Use Documents 09–14 as the engineering source of truth.
4. Use Documents 15–19 to control AI-assisted implementation, security, testing and operations.
5. Use Document 20 to decide what ships now versus later.
6. Record material architectural changes in Document 19 before implementation drift occurs.

## Documents

01. Global Market Research Report  
02. Competitive Analysis  
03. Gap Analysis  
04. Product Vision and Mission  
05. Product Bible  
06. Product Requirements Document  
07. UX Blueprint  
08. Feature Catalog  
09. Technical Architecture  
10. Database Architecture  
11. Security Architecture  
12. API Specification  
13. Engineering Standards  
14. Infrastructure Guide  
15. AI Development Manual  
16. Security Review Playbook  
17. Testing Manual  
18. Operations Manual  
19. Decision Register  
20. Product Roadmap  

## Current implementation baseline

The current application is a React 19/Vite SPA with Tailwind CSS v4, Radix/shadcn components, React Router, a PWA shell, an existing transaction state machine, admin screens, and a mock/Convex-compatible data layer. The current transition plan introduces a Node/Express trusted server layer, repository/service abstractions and Turso/libSQL as the temporary development database.

## Core company rule

DealSure should be built as **trust orchestration**, not as “a database app” and not as a casually self-declared escrow custodian. Customer-funds custody, payout timing, KYC/AML responsibilities and the legality of any “escrow” claim must be confirmed with qualified Nigerian counsel and licensed payment partners before live-money launch.



---


# 01 — Global Market Research Report

**Research snapshot:** 2026-09-09

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## Executive summary

The market already contains several classes of products that solve pieces of DealSure’s problem:

1. **Direct escrow services** — e.g. Escrow.com, EscrowLock and Pandascrow.
2. **Marketplace payment infrastructure** — e.g. Stripe Connect, Adyen for Platforms, Online Payment Platform, Paystack split payments, Flutterwave split payments and Monnify marketplace tools.
3. **Closed-loop trust marketplaces** — e.g. Upwork and eBay, where payment protection, disputes and evidence are embedded into the marketplace experience.
4. **Identity, KYC, fraud and compliance infrastructure** — normally integrated as supporting layers rather than presented as the product itself.

The strongest recurring pattern is not simply “hold money.” It is:

**agreed terms → verified funding → visible protected status → performance/delivery → inspection/acceptance → dispute freeze if needed → controlled release/refund → audit trail**

That is extremely close to DealSure’s intended core workflow.

The strategic opportunity is therefore **not to invent escrow from scratch**. It is to build a mobile-first trust orchestration product for social and peer-to-peer commerce, especially transactions that begin outside a formal marketplace — WhatsApp, Instagram, social media, direct seller links, small merchants and informal digital commerce.

## 1. Problem landscape

Online transactions between strangers suffer from several forms of uncertainty:

- Buyer fears paying and receiving nothing or receiving the wrong item.
- Seller fears delivering without payment certainty.
- Both parties lack a shared record of what was agreed.
- Evidence is fragmented across WhatsApp, screenshots and bank-transfer receipts.
- Dispute expectations are unclear until something goes wrong.
- Informal commerce rarely offers a structured inspection window or neutral resolution process.
- Payment providers can move money but often do not provide the complete trust workflow.
- Marketplaces can provide protection, but only for transactions that occur inside their own marketplace.

DealSure’s target problem is therefore broader than checkout: **transaction confidence across the whole lifecycle**.

## 2. Direct escrow category

### Escrow.com

Escrow.com uses a classic sequence: buyer and seller agree terms; buyer funds the transaction; payment is verified; seller ships or performs; buyer receives an inspection/acceptance period; funds release to seller after acceptance or applicable completion conditions.

**What to learn**
- Explicit agreement before money movement.
- “Good funds” verification before seller performance.
- Inspection period as a first-class concept.
- Delivery/tracking as transaction evidence.
- Release only after defined conditions.
- Strong separation between transaction state and payment state.

**What not to copy blindly**
- A direct licensed escrow operating model cannot simply be reproduced by software without the necessary legal/custody framework.

### EscrowLock — Nigeria

EscrowLock positions itself around buyer and seller protection in Nigeria and describes receiving/securing buyer payment and releasing it after the buyer receives the goods/services in agreed condition.

**What to learn**
- Nigerian users already understand the buyer-protection/seller-protection proposition.
- Local product language can be simple and direct.
- Trust is a recognized pain point in MSME and social commerce.

### Pandascrow

Pandascrow is particularly relevant because it combines consumer/business escrow flows with APIs. Its public materials describe:
- one-time escrow,
- milestone escrow,
- split-payment escrow,
- configurable release logic,
- payer/payee/observer roles,
- disputes and audit history,
- payment links,
- wallets and payouts,
- marketplace use cases,
- KYC/business verification.

**What to learn**
- Escrow infrastructure can become a platform primitive, not only a consumer app.
- Payment links are valuable for commerce that starts in chat/social media.
- Milestones create a future path into services, B2B and freelance transactions.
- API-first infrastructure can become a second business line later.
- Disputes, files, notes and audit history belong close to the transaction.

## 3. Marketplace payment infrastructure

### Online Payment Platform

Its marketplace materials combine onboarding, identity/business/bank verification, escrow and split payments, conditional releases, real-time/scheduled payouts and branded checkout.

**Lesson:** the difficult part of platform payments is not just collecting money. It is onboarding, compliance, fund-routing, conditional payout and reconciliation.

### Stripe Connect

Stripe Connect supports platform/marketplace payments, connected accounts, payout timing and models including separate charges and transfers. Stripe explicitly documents use cases where a platform may delay transfer until goods/services are delivered.

**Lesson:** DealSure should keep payment-provider integration abstract. The product should decide the transaction release state; the provider executes authorized money movement.

### Adyen for Platforms

Adyen combines seller/provider onboarding, payment processing, balance accounts, fraud controls, reporting and payout control.

**Lesson:** a mature version of DealSure will need:
- identity/onboarding,
- liability and risk policy,
- payout controls,
- fraud/risk flags,
- reconciliation reports,
- operational dashboards.

### Nigerian payment rails: Paystack, Flutterwave and Monnify

Paystack and Flutterwave both expose split/subaccount payment capabilities for marketplace scenarios. Flutterwave explicitly warns marketplace operators that they are responsible for vetting merchants and that disputes/chargebacks affect the marketplace account. Monnify markets payment collection, payouts, virtual accounts and marketplace flows.

**Lesson:** split payment is not automatically escrow. DealSure must not confuse “split settlement” with legal custody or protected holding. Provider agreements must explicitly support the intended delayed/conditional payout flow.

## 4. Marketplace trust systems

### Upwork

Upwork’s fixed-price protection uses funded milestones before work begins and a defined review/dispute process before release.

**Lesson:** “fund before performance” is powerful seller assurance. Milestones are a future expansion path.

### eBay

eBay’s Money Back Guarantee formalizes eligibility rules, delivery evidence, returns/refunds and platform intervention. Dispute-related payment holds can set aside funds while the case is unresolved.

**Lesson:** protection rules must be explicit, time-bound and evidence-aware. Support teams need structured case tools, not free-form judgment only.

## 5. Recurring trust primitives across the market

The research suggests these reusable primitives:

- **Agreement object** — exactly what is being bought/sold.
- **Protected transaction reference** — one durable identifier.
- **Funding state** — not paid / processing / secured / failed / refundable.
- **Performance state** — seller preparation, dispatch, delivery or milestone completion.
- **Inspection window** — defined time after delivery/performance.
- **Evidence** — tracking, attachments, messages, system events.
- **Communication** — transaction-specific conversation.
- **Dispute freeze** — prevents payout while unresolved.
- **Release rules** — buyer acceptance, expiry, verified event, authorized resolution.
- **Refund rules** — full/partial, remaining refundable amount, audit.
- **Payout/settlement rules** — once only, idempotent, risk-aware.
- **Identity and roles** — parties, staff, finance, dispute agent.
- **Audit trail** — append-only important events.
- **Risk layer** — suspicious patterns, account restrictions, manual review.
- **Notification layer** — email/push/in-app/SMS/WhatsApp where justified.
- **API layer** — eventually allows merchants/marketplaces to embed DealSure.

## 6. Nigeria market context

Nigeria has an established regulated payments ecosystem with licensed categories including mobile money operators, switching/processing providers and payment solution service providers. CBN’s public provider lists include major companies such as OPay, PalmPay, Flutterwave, Paystack and TeamApt/Monnify-related entities.

For DealSure, the strategic implication is:

**Partner first; do not casually become the custodian.**

The initial launch model should seek a licensed payment partner whose contract and APIs explicitly support the required fund flow, payout timing, refunds, chargebacks and merchant onboarding.

Nigeria’s Data Protection Act 2023 and NDPC guidance also make privacy, security, lawful processing and accountability part of the product architecture, not an afterthought.

## 7. Global opportunity

The product can expand beyond Nigerian social commerce if the underlying transaction engine stays generic.

Potential verticals:
- social commerce,
- direct merchant sales,
- used goods,
- electronics,
- freelance services,
- milestone services,
- B2B procurement,
- deposits/reservations,
- marketplace integrations,
- imports/exports where supported,
- creator/vendor transactions.

The expansion should happen through **configurable transaction templates**, not by hard-coding a new application for every vertical.

## 8. Strategic recommendation

DealSure should position itself as a **trust layer for transactions that happen between people or businesses who need a structured, verifiable process**.

The initial wedge should remain narrow:

> A seller creates a protected transaction, shares it with a buyer, the buyer reviews and funds through the approved payment flow, the seller delivers, the buyer inspects, and DealSure coordinates acceptance, dispute, refund or release.

Then expand into:
- merchant tools,
- milestone payments,
- platform APIs,
- partner delivery integrations,
- identity/reputation,
- embedded transaction protection.

## 9. Research limitations

Public websites describe marketed capabilities but do not reveal all internal controls, provider contracts, licensing arrangements, fraud rules or operational procedures. Claims by competitors about escrow, licensing, AI dispute resolution, user counts or fund custody should be independently verified before being used for legal or strategic decisions.

User-mentioned names such as Spacecrow, Escrow-Pay and Rainy Trust should remain in a follow-up research queue if their official identity/product pages cannot be reliably verified.

## Sources

- **Escrow.com:** https://www.escrow.com/learn-more/how-escrow-works/how-escrow-works
- **EscrowLock:** https://www.escrowlock.com/
- **Pandascrow Escrow:** https://pandascrow.io/solutions/escrow
- **Pandascrow API:** https://pandascrow.readme.io/reference/escrow
- **Online Payment Platform Marketplace:** https://www.onlinepaymentplatform.com/for-who/by-type/marketplace
- **Stripe Connect Marketplace:** https://docs.stripe.com/connect/marketplace
- **Stripe Separate Charges/Transfers:** https://docs.stripe.com/connect/separate-charges-and-transfers
- **Adyen for Platforms:** https://docs.adyen.com/adyen-for-platforms-model/
- **Paystack Split Payments:** https://paystack.com/docs/payments/split-payments/
- **Flutterwave Split Payments:** https://developer.flutterwave.com/v3.0/docs/split-payments
- **Monnify Marketplaces:** https://monnify.com/use-cases/marketplaces
- **Upwork Fixed-Price Protection:** https://support.upwork.com/hc/en-us/articles/211063748-How-Fixed-Price-Payment-Protection-works-for-freelancers-on-Upwork
- **eBay Money Back Guarantee:** https://www.ebay.com/help/policies/ebay/ebay?id=4210
- **CBN Payment Service Providers:** https://www.cbn.gov.ng/PaymentsSystem/PSPs.html
- **CBN Payments System:** https://www.cbn.gov.ng/PaymentsSystem/
- **NDPC NDP Act:** https://www.ndpc.gov.ng/ndp-act-2023/
- **NDPC FAQ:** https://www.ndpc.gov.ng/faqs/
- **Turso Pricing:** https://turso.tech/pricing
- **Turso:** https://turso.tech/



---


# 02 — Competitive Analysis

**Research snapshot:** 2026-09-09

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Competitive framing

DealSure competes across three layers, not one:

- **Direct protected-transaction products** — Escrow.com, EscrowLock, Pandascrow.
- **Payment infrastructure** — Stripe Connect, Adyen, OPP, Paystack, Flutterwave, Monnify.
- **Closed marketplaces with built-in protection** — Upwork, eBay and similar platforms.

The product should not try to beat every company at its own specialty. It should combine the most useful trust patterns into a simpler experience for transactions that originate outside a traditional marketplace.

## 2. Competitive matrix

| Platform | Main model | Buyer/seller agreement | Conditional release | Inspection/review | Disputes | API/embedded | Seller onboarding/KYC | Messaging/evidence | Nigeria relevance |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Escrow.com | Direct escrow | Strong | Strong | Strong | Yes | Yes/partner capabilities | Yes | Limited compared with marketplace workspace | Medium |
| EscrowLock | Direct escrow | Strong | Strong | Yes | Yes | Limited/publicly unclear | Yes | Publicly unclear | High |
| Pandascrow | Escrow platform/API | Strong | Strong | Configurable | Yes | Strong | KYC/business verification | Files/notes/messaging advertised | High |
| Online Payment Platform | Marketplace payments | Platform-defined | Strong | Platform-defined | Platform-defined | Strong | Strong | Platform-defined | Low/medium |
| Stripe Connect | Payment infrastructure | App-defined | Strong payout control | App-defined | Payment disputes + app logic | Very strong | Connected accounts | App-defined | Regional/provider-fit dependent |
| Adyen for Platforms | Payment infrastructure | App-defined | Strong payout control | App-defined | Payment/risk tooling | Very strong | Strong | App-defined | Enterprise/global |
| Paystack | Payments/split settlement | App-defined | Not automatically escrow | App-defined | Chargeback/payment support | Strong | Subaccounts | App-defined | Very high |
| Flutterwave | Payments/split settlement | App-defined | Not automatically escrow | App-defined | Chargebacks; marketplace liable | Strong | Subaccounts | App-defined | Very high |
| Monnify | Marketplace payments | App-defined | Payout controls | App-defined | App-defined | Strong | Payment/identity tools | App-defined | Very high |
| Upwork | Closed freelance marketplace | Strong milestone contract | Strong | Review period | Strong | Not its primary model | Strong | Strong | Indirect |
| eBay | Closed marketplace | Listing/order terms | Platform-controlled | Returns/eligibility windows | Strong | Not primary | Seller controls | Case/evidence flows | Indirect |

## 3. What each class does better than DealSure today

### Direct escrow products
They have market experience, operational dispute processes, established payment/custody arrangements and clearer legal positioning.

### Payment infrastructure providers
They have payment rails, banking relationships, payout systems, KYC, chargeback handling, reconciliation and high reliability.

### Closed marketplaces
They control the entire commercial context: listing, payment, messaging, delivery signals, reputation and dispute policy.

## 4. Where DealSure can differentiate

### 4.1 Transaction starts anywhere
A DealSure transaction can originate from:
- WhatsApp,
- Instagram,
- a DM,
- a merchant website,
- a QR code,
- a direct link,
- later, an API.

This is a meaningful wedge because many trust systems require users to transact inside a marketplace.

### 4.2 Transaction workspace, not just payment link
The transaction page should combine:
- terms,
- payment status,
- delivery,
- countdowns,
- communication,
- evidence,
- dispute,
- refund/release status,
- system timeline.

### 4.3 Buyer and seller symmetry
Many protection products market heavily to one side. DealSure should explicitly communicate:
- buyer protection from non-delivery/misrepresentation,
- seller assurance that verified funds exist before performance,
- rules that prevent bad-faith release/refund actions.

### 4.4 Nigeria-first simplicity
Local payment methods, bank-transfer familiarity, mobile-first UI, low-bandwidth behavior, understandable language and local dispute operations can outperform a globally generic experience.

### 4.5 Provider-agnostic trust engine
The transaction engine should survive payment-provider changes. Payments are adapters beneath the product’s domain rules.

### 4.6 Trust history
A future reputation layer can use completed transactions, verified identity, dispute outcomes and behavior patterns — while avoiding a simplistic opaque “social credit” score.

## 5. Competitive risks

- A licensed escrow competitor can copy UX features.
- A payment provider can add conditional release products.
- Fraud losses can destroy an early-stage platform.
- Poor dispute decisions can harm both sides of the marketplace.
- “Escrow” branding without legal structure can create regulatory exposure.
- Price competition can make pure percentage-fee models unattractive for large transactions.

## 6. Recommended positioning

**Working positioning statement**

> DealSure helps buyers and sellers complete protected transactions with clear terms, verified payment status, delivery tracking, transaction messaging and structured dispute resolution — even when the deal started somewhere else.

Avoid leading with technical payment language. Lead with the trust outcome.

## Sources

- **Escrow.com:** https://www.escrow.com/learn-more/how-escrow-works/how-escrow-works
- **EscrowLock:** https://www.escrowlock.com/
- **Pandascrow Escrow:** https://pandascrow.io/solutions/escrow
- **Pandascrow API:** https://pandascrow.readme.io/reference/escrow
- **Online Payment Platform Marketplace:** https://www.onlinepaymentplatform.com/for-who/by-type/marketplace
- **Stripe Connect Marketplace:** https://docs.stripe.com/connect/marketplace
- **Stripe Separate Charges/Transfers:** https://docs.stripe.com/connect/separate-charges-and-transfers
- **Adyen for Platforms:** https://docs.adyen.com/adyen-for-platforms-model/
- **Paystack Split Payments:** https://paystack.com/docs/payments/split-payments/
- **Flutterwave Split Payments:** https://developer.flutterwave.com/v3.0/docs/split-payments
- **Monnify Marketplaces:** https://monnify.com/use-cases/marketplaces
- **Upwork Fixed-Price Protection:** https://support.upwork.com/hc/en-us/articles/211063748-How-Fixed-Price-Payment-Protection-works-for-freelancers-on-Upwork
- **eBay Money Back Guarantee:** https://www.ebay.com/help/policies/ebay/ebay?id=4210
- **CBN Payment Service Providers:** https://www.cbn.gov.ng/PaymentsSystem/PSPs.html
- **CBN Payments System:** https://www.cbn.gov.ng/PaymentsSystem/
- **NDPC NDP Act:** https://www.ndpc.gov.ng/ndp-act-2023/
- **NDPC FAQ:** https://www.ndpc.gov.ng/faqs/
- **Turso Pricing:** https://turso.tech/pricing
- **Turso:** https://turso.tech/



---


# 03 — Gap Analysis

**Research snapshot:** 2026-09-09

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. The core market gap

The market has payment rails, escrow providers and closed marketplaces. The gap DealSure can pursue is the space between them:

> **A portable transaction workspace for deals that begin outside a marketplace.**

A buyer and seller should be able to turn an informal agreement into a structured protected transaction without moving their entire commerce relationship into a new marketplace.

## 2. Gap map

| Gap | Existing market weakness | DealSure response |
|---|---|---|
| Social-commerce trust | DMs and WhatsApp lack shared transaction state | Shareable protected transaction link |
| Fragmented evidence | Screenshots, chats and receipts live everywhere | Transaction workspace + evidence timeline |
| Seller confidence | Buyer-protection products can feel one-sided | Verified funding state before delivery |
| Buyer confidence | Direct transfer offers weak recourse | Conditional release/refund rules |
| Dispute clarity | Rules often appear only after conflict | Show dispute eligibility/timers upfront |
| Cross-provider dependence | Apps become tied to one gateway | Payment provider abstraction |
| Small-merchant onboarding | Full marketplace setup is heavy | Link-first transaction creation |
| Operational visibility | Support teams work from scattered tools | Mission-control admin workspace |
| Future embedded use | Consumer apps often lack API primitives | API-first domain model later |
| Reputation portability | Marketplace reputation is locked inside one marketplace | DealSure transaction history/reputation layer |

## 3. Product gaps to solve before launch

### Identity
- Verified contact information.
- Risk-based identity checks.
- Business verification for merchants.
- Staff/admin identity hardening and MFA.
- Clear participant identity without oversharing personal data.

### Agreement
- Item/service description.
- Price and fees.
- delivery method/deadline.
- inspection window.
- return/refund terms.
- evidence expectations.
- acceptance of current terms version.

### Payment
- Signed/idempotent provider events.
- clear “secured” versus “processing” semantics.
- never trust browser redirects.
- payout/release policy aligned with payment partner contract.

### Delivery
- tracking reference.
- delivery status.
- evidence events.
- OTP as supporting evidence only.
- inspection timer triggered by a trusted delivery event.

### Dispute
- allowed reasons.
- evidence.
- deadlines.
- communication.
- settlement freeze.
- staff queue.
- resolution options.
- appeal/escalation policy.

### Operations
- immutable audit trail.
- risk flags.
- manual action reasons.
- role-based admin access.
- reconciliation.
- incident runbooks.

## 4. Strategic gaps that should remain future work

Do not overload MVP with:
- consumer wallet,
- lending,
- crypto,
- investment,
- general marketplace listings,
- unrelated social features,
- broad AI automation that makes binding financial decisions.

## 5. Biggest opportunity

The strongest differentiated product is not “another escrow app.” It is:

**agreement + payment assurance + delivery + communication + evidence + resolution in one portable workspace.**

That framing should drive design, architecture and marketing.



---


# 04 — Product Vision and Mission

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## Vision

To become a trusted transaction layer that lets people and businesses trade confidently even when they do not already trust each other.

## Mission

Make high-risk online transactions feel structured, understandable and fair by combining clear agreement, protected payment flow, delivery evidence, communication and dispute resolution in one transaction workspace.

## Product promise

**You do not have to blindly trust a stranger; you should be able to trust the process.**

## Initial market

Nigeria-first:
- social-commerce buyers,
- Instagram/WhatsApp sellers,
- small merchants,
- peer-to-peer transactions,
- direct digital commerce.

## Long-term market

A global trust infrastructure platform for:
- marketplaces,
- B2B commerce,
- service milestones,
- merchant websites,
- platform APIs,
- vertical transaction products.

## Product principles

1. **Trust must be visible.** Users should always know the current transaction state.
2. **Money state is server-authoritative.**
3. **Protection must be symmetrical.** Buyer protection must not become seller abuse, and vice versa.
4. **Every important action leaves evidence.**
5. **Disputes freeze irreversible release.**
6. **Simple outside, rigorous underneath.**
7. **The product is provider-agnostic.**
8. **Privacy by design.**
9. **No misleading regulatory claims.**
10. **Mobile first, platform ready.**

## North-star metric

**Successfully protected transactions completed without unresolved loss or manual escalation.**

Supporting metrics:
- transaction completion rate,
- funded-to-delivered conversion,
- dispute rate,
- median resolution time,
- repeat buyer/seller rate,
- payout failure rate,
- fraud-loss rate,
- support contacts per transaction,
- time from transaction creation to successful completion.

## Positioning

> DealSure turns an informal buyer–seller agreement into a clear protected transaction with payment status, delivery, messaging, evidence and resolution in one place.

## Non-goals

DealSure is not initially:
- a bank,
- a consumer wallet,
- a lender,
- a crypto product,
- an investment app,
- a broad social network,
- a general-purpose marketplace.



---


# 05 — Product Bible

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Product identity

**Category:** transaction trust / protected commerce platform  
**Initial wedge:** transactions originating in social/direct commerce  
**Core unit:** the transaction workspace  
**Core outcome:** both parties understand what was agreed, whether payment is protected, what happens next and how problems are resolved.

## 2. Personas

### Buyer
Needs confidence that:
- the seller is real enough to transact with,
- payment will not simply disappear,
- the delivered item/service can be checked,
- there is a dispute path.

### Seller
Needs confidence that:
- buyer payment is genuinely secured before performance,
- buyer cannot arbitrarily reverse after successful delivery,
- evidence and agreed terms matter,
- payout happens predictably.

### Merchant
Needs:
- repeatable transaction creation,
- branded share links,
- customer history,
- settlement visibility,
- staff/merchant team roles,
- API integration later.

### Support
Needs:
- transaction overview,
- communication history,
- evidence,
- user identity/risk context,
- safe non-financial actions.

### Dispute agent
Needs:
- case queue,
- structured evidence,
- frozen payout state,
- policy-driven decisions,
- reason codes,
- audit.

### Finance
Needs:
- provider reconciliation,
- ledger,
- refund/settlement queues,
- payout failures,
- immutable financial history.

### Operations/super admin
Needs:
- platform health,
- risk,
- incidents,
- role management,
- audit,
- exceptional-action controls.

## 3. Jobs to be done

**Buyer:** “When I want to buy from someone I do not fully trust, help me pay without feeling like I am gambling with my money.”

**Seller:** “When I am about to deliver to a stranger, show me that the transaction is genuinely funded and that I will be paid if I perform correctly.”

**Merchant:** “Let me convert a conversation into a professional protected transaction without building my own payment infrastructure.”

## 4. Transaction doctrine

A transaction consists of:
- parties,
- terms,
- items/services,
- amount,
- payment status,
- delivery/performance status,
- communication,
- evidence,
- timers,
- dispute state,
- settlement/refund state,
- audit history.

The transaction is not “complete” merely because payment was collected.

## 5. Canonical lifecycle

DRAFT  
→ PENDING_BUYER_ACCEPTANCE  
→ AWAITING_PAYMENT  
→ PAYMENT_PROCESSING  
→ PAYMENT_SECURED  
→ READY_FOR_DELIVERY  
→ DISPATCHED  
→ DELIVERED_PENDING_INSPECTION  
→ ACCEPTED  
→ RELEASE_PENDING  
→ SETTLED

Alternative branches:
- DISPUTED
- REFUND_PENDING → REFUNDED
- CANCELLED
- EXPIRED

## 6. Trust layers

### Agreement trust
Both sides see the same terms.

### Identity trust
Risk-based verification, not oversharing.

### Payment trust
Seller sees a server-verified funding state.

### Delivery trust
Tracking, delivery events and evidence.

### Communication trust
Messages are attached to the transaction.

### Resolution trust
Dispute rules are known and actions are audited.

### Reputation trust
Future trust profile based on verified transaction history, not arbitrary popularity.

## 7. Communication doctrine

A transaction conversation must distinguish:
- user messages,
- system messages,
- payment events,
- delivery events,
- dispute events,
- staff actions.

System events cannot be impersonated by users.

## 8. Dispute doctrine

A valid dispute:
- freezes payout,
- preserves evidence,
- has deadlines,
- records case reason,
- allows authorized staff review,
- results in an explicit resolution,
- leaves immutable audit history.

AI may summarize evidence or assist triage, but should not autonomously make binding financial decisions without a separately approved policy and human oversight.

## 9. Reputation doctrine

Future reputation should use transparent components such as:
- completed protected transactions,
- verified identity/business status,
- delivery reliability,
- dispute frequency and outcomes,
- account age,
- policy violations.

Avoid one opaque “trust score” that users cannot understand or challenge.

## 10. Business model hypotheses

Possible revenue streams:
- transaction protection fee,
- merchant subscription,
- API usage,
- premium dispute handling/service levels,
- value-added verification,
- enterprise integration.

Do not finalize pricing until payment-provider cost, dispute cost, fraud loss and customer willingness-to-pay are measured.

## 11. Product language

Until legal/custody structure is confirmed, prefer:
- Protected Transaction
- Payment Secured
- Protected Payment
- Funds Secured With Payment Partner

Avoid unqualified:
- “licensed escrow”
- “we hold your money in escrow”
unless legally accurate and partner-approved.

## 12. Product success test

A first-time Nigerian buyer receiving a transaction link should be able to understand in under one minute:
- who the seller is,
- what is being purchased,
- amount,
- payment protection,
- delivery expectation,
- inspection/dispute rules,
- what happens next.



---


# 06 — Product Requirements Document (PRD)

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Objective

Build a mobile-first protected transaction platform where a seller can create a transaction, share it with a buyer, secure payment through an approved provider flow, deliver goods/services, receive buyer acceptance or enter a dispute workflow, and settle/refund under controlled server-authoritative rules.

## 2. Platforms

- Responsive web application.
- Installable PWA.
- Admin web application.
- Future iOS/Android native applications using the same backend/domain APIs.
- Public marketing website.
- Future merchant/API integrations.

## 3. P0 functional requirements

### Authentication and profile
- Email/phone authentication through a proven auth system.
- Server-validated sessions.
- profile creation.
- buyer/seller multi-role capability.
- admin/staff roles from trusted database state.
- logout and session revocation.

### Create transaction
Seller can define:
- title,
- description,
- item(s),
- quantity,
- amount,
- delivery fee,
- currency,
- delivery method/deadline,
- inspection window,
- return terms.

### Share/review
- Generate high-entropy invite/reference link.
- Buyer can view minimum safe transaction information.
- Buyer must authenticate before consequential actions.
- Buyer accepts transaction and current terms version.

### Payment
- Create payment intent server-side.
- Provider redirect/checkout as needed.
- Provider webhook is signed/verified/idempotent.
- Browser cannot mark payment successful.
- Seller sees PAYMENT_SECURED only after trusted verification.

### Delivery
- Seller can mark ready/dispatched.
- tracking info.
- delivery events.
- secure OTP if used.
- delivery event starts inspection window only through trusted logic.

### Transaction workspace
- current status,
- next action,
- payment status,
- delivery status,
- countdowns,
- messages,
- attachments/evidence,
- system event timeline.

### Acceptance
- Buyer can accept after eligible delivery state.
- Acceptance moves transaction toward release.
- settlement request is server-authoritative.

### Dispute
- Buyer or seller can open only when eligible.
- dispute freezes release.
- reason/category.
- evidence.
- case communication.
- staff queue.
- resolution to refund/release/partial outcome where policy permits.

### Notifications
- in-app notification.
- extensible email/SMS/push channels.
- idempotent delivery tracking for notification jobs.

### Admin
- search transactions/users by safe identifiers.
- dispute queue.
- payment/refund/settlement visibility.
- risk flags.
- admin notes.
- audit timeline.
- role-restricted actions.

## 4. P1 requirements

- Merchant profiles and reusable templates.
- saved bank/payout destinations via provider tokens/references.
- delivery partner integration.
- richer KYC/business verification.
- partial refunds.
- milestone transactions.
- trust/reputation profile.
- push notifications.
- analytics and merchant reporting.

## 5. P2 requirements

- Embedded/API product.
- marketplace integrations.
- multi-party/split transactions.
- cross-border currencies where legally/provider supported.
- enterprise controls.
- native apps if PWA does not meet product needs.
- configurable workflow templates.

## 6. Non-functional requirements

### Security
- least privilege,
- no secrets in client bundles,
- strong session protection,
- rate limiting,
- audit,
- dependency scanning,
- server-side authorization,
- idempotent financial actions.

### Reliability
- webhook retries,
- idempotency,
- migration discipline,
- database backups,
- monitoring/alerts,
- safe degradation.

### Performance
- core mobile pages should remain usable on slower Nigerian mobile connections.
- avoid excessive JS and image payloads.
- paginated transaction/message lists.

### Accessibility
- keyboard navigation,
- labels,
- focus states,
- WCAG-aware contrast,
- reduced motion,
- screen-reader semantics.

### Privacy
- data minimization,
- private evidence storage,
- retention rules,
- data-subject workflow,
- access logging for sensitive evidence.

## 7. Financial invariants

- money stored in integer minor units.
- refund > 0.
- total pending/successful refund cannot exceed refundable amount.
- no duplicate provider event processing.
- no double successful settlement.
- ledger transactions balance if ledger is active.
- dispute blocks release.
- settlement cannot be browser-authored.

## 8. Acceptance criteria for MVP

MVP is ready for controlled pilot only when:
- seller → buyer → payment sandbox → delivery → acceptance → settlement simulation passes end-to-end.
- dispute → evidence → authorized resolution → refund/release simulation passes.
- authorization tests prove unrelated users cannot access another transaction.
- admin role escalation is prevented.
- secrets are absent from client bundle and source.
- logs/audit support incident investigation.
- legal/payment-partner review has defined what live-money claims and fund flows are permitted.

## 9. Explicitly out of scope for initial MVP

- lending,
- consumer stored-value wallet,
- crypto,
- investment,
- gambling,
- unrelated marketplace discovery,
- autonomous AI financial decisions.



---


# 07 — UX Blueprint

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. UX objective

Every important screen should answer:
1. What is happening?
2. Is my transaction protected?
3. What do I need to do next?
4. What happens if something goes wrong?

## 2. Information architecture

### Public
- Landing
- How it works
- Pricing (later)
- Trust & safety
- Help
- Transaction invite preview
- Auth

### Authenticated customer
- Home
- Transactions
- Create
- Messages
- Notifications
- Profile
- Transaction workspace

### Admin
- Overview
- Transactions
- Disputes
- Payments
- Refunds
- Settlements
- Risk
- Users/KYC
- Audit
- System health

## 3. Mobile navigation

Recommended bottom navigation:
- Home
- Transactions
- Create
- Messages
- Profile

Notifications can be reached from top-bar icon.

## 4. Desktop navigation

Refined left sidebar:
- Home
- Transactions
- Messages
- Notifications
- Profile

Admin users receive a separately styled operational workspace rather than mixing privileged controls into normal customer pages.

## 5. Transaction workspace anatomy

### Header
- reference,
- state badge,
- amount,
- counterparty,
- created date.

### Next action card
One dominant action only where possible.

Examples:
- “Review and accept transaction”
- “Complete payment”
- “Prepare for delivery”
- “Confirm dispatch”
- “Inspect your delivery”
- “Respond to dispute”

### Lifecycle
Readable timeline of agreement → payment → delivery → inspection → completion.

### Payment module
- amount,
- current payment state,
- provider-safe reference,
- fee disclosure,
- protected-payment explanation.

### Delivery module
- method,
- tracking,
- dispatch time,
- delivery state,
- inspection deadline.

### Conversation
- user chat,
- system events,
- attachments,
- evidence.

### Resolution
- dispute eligibility,
- active dispute,
- refund/settlement state.

## 6. Invite flow

1. Seller shares link.
2. Buyer sees seller display identity, item/service, amount and protection explanation.
3. Buyer sees what payment protection does and does not cover.
4. Buyer authenticates.
5. Buyer reviews terms.
6. Buyer accepts.
7. Payment flow begins.

Never make the invite URL itself authority for financial actions.

## 7. Trust cues

Use:
- explicit status labels,
- timestamps,
- verified-event labels,
- clear deadlines,
- “system event” styling,
- reasoned explanations,
- visible dispute rules.

Avoid:
- fake shield icons without meaning,
- vague “100% safe” claims,
- legal promises that cannot be supported.

## 8. Design direction

Reference quality:
- Stripe clarity,
- Supabase information density,
- Linear polish,
- Vercel restraint,
- high-quality fintech patterns.

Do not pixel-copy.

Visual principles:
- neutral surfaces,
- strong typography,
- subtle borders,
- restrained elevation,
- semantic status colors,
- minimal gradients,
- purposeful motion,
- excellent empty/loading/error states.

## 9. Accessibility

- 44px-ish touch targets where practical.
- keyboard-first operability on desktop.
- visible focus.
- meaningful headings.
- form errors tied to controls.
- text alternatives for evidence thumbnails.
- reduced-motion support.
- do not encode transaction state only through color.

## 10. Low-bandwidth behavior

- lazy-load evidence/media.
- compress images client-side only for convenience; server still validates.
- skeletons rather than blocking whole page.
- preserve text transaction state if rich media fails.
- avoid auto-playing video.



---


# 08 — Feature Catalog

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

Legend: **P0** MVP/pilot critical, **P1** near-term, **P2** expansion.

| Domain | Feature | Priority | Notes |
|---|---|---:|---|
| Identity | Authenticated accounts | P0 | Proven auth/session implementation |
| Identity | Buyer + seller multi-role | P0 | Same account can do both |
| Identity | Merchant verification | P1 | Risk/limit based |
| Identity | Staff MFA | P0 | Before privileged launch |
| Transaction | Create protected transaction | P0 | Seller-driven |
| Transaction | Shareable invite link | P0 | High entropy |
| Transaction | Terms acceptance/version | P0 | Immutable history |
| Transaction | State machine | P0 | Server authoritative |
| Transaction | Timeline/history | P0 | User-visible subset |
| Payment | Payment intent | P0 | Sandbox then partner |
| Payment | Signed webhook verification | P0 | Before live money |
| Payment | Provider abstraction | P0 | Avoid lock-in |
| Payment | Split payments | P1 | Only if partner model supports |
| Delivery | Dispatch/tracking | P0 | Core goods workflow |
| Delivery | Delivery OTP | P0 optional | Supporting evidence only |
| Delivery | Courier integration | P1 | Adapter pattern |
| Inspection | Configurable inspection window | P0 | Policy bounds |
| Messaging | Transaction chat | P0 | Participant-scoped |
| Messaging | System event messages | P0 | Immutable/verified |
| Messaging | Attachments | P0 | Private storage |
| Disputes | Open dispute | P0 | Eligible states only |
| Disputes | Evidence | P0 | Structured |
| Disputes | Admin resolution console | P0 | Audited |
| Refund | Full refund | P0 | Trusted server |
| Refund | Partial refund | P1 | Cap + race protection |
| Settlement | Single authorized payout | P0 | Idempotent |
| Ledger | Double-entry ledger | P0 if money live | Required for reliable reconciliation |
| Notifications | In-app | P0 | Core |
| Notifications | Email | P0/P1 | Auth and lifecycle |
| Notifications | Push | P1 | Native/PWA support |
| Notifications | SMS/WhatsApp | P1/P2 | Cost and consent |
| Admin | Mission-control dashboard | P0 | Ops visibility |
| Admin | Risk flags | P0 | Manual + automated later |
| Admin | Audit log | P0 | Append-only |
| Reputation | Transaction history | P1 | Transparent |
| Reputation | Trust profile | P1/P2 | Explainable signals |
| Merchant | Reusable transaction templates | P1 | Social sellers |
| Merchant | Branded links | P1 | Controlled branding |
| API | Merchant API | P2 | After internal APIs stabilize |
| API | Webhooks to merchants | P2 | Signed |
| Services | Milestone transactions | P2 | Freelance/B2B |
| Platform | Native apps | P1/P2 | Based on PWA learning |
| Platform | Multi-currency | P2 | Legal/provider dependent |



---


# 09 — Technical Architecture

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Current baseline

Current codebase assessment indicates:
- React 19 + Vite SPA,
- Tailwind CSS v4,
- Radix/shadcn components,
- React Router with lazy loading,
- PWA manifest/service worker,
- existing Convex-compatible hooks/mock provider,
- Node server entry,
- transaction/admin pages already present.

## 2. Target startup architecture

```text
Marketing site / Web PWA / Future native apps
                 |
             HTTPS API
                 |
        Trusted Node/Express server
      ┌──────────┼───────────┐
      |          |           |
 Auth/session  Domain     Notifications
      |       services        |
      |          |
 Authorization  |
      |          |
      └──── Repositories ─────┐
                              |
                           Turso
                      (temporary DB)
                              |
                 Payment / KYC / Delivery
                    provider adapters
```

## 3. Architectural rules

- React never contains raw SQL.
- Browser never holds Turso auth token.
- Browser never determines financial truth.
- Services contain business rules.
- Repositories contain persistence details.
- Provider adapters isolate payment/KYC/courier vendors.
- Domain events create audit/notifications.
- Financial writes are transactional and idempotent.

## 4. Suggested folder structure

```text
src/
  app/
  components/
  features/
  hooks/
  lib/
  pages/

server/
  api/
  auth/
  config/
  db/
    client.ts
    migrate.ts
    migrations/
  domain/
  middleware/
  providers/
    payments/
    identity/
    delivery/
    notifications/
  repositories/
  security/
  services/
  jobs/
```

## 5. Data access

UI calls typed API client.

API handler:
1. validates session,
2. parses input,
3. calls service,
4. service authorizes domain action,
5. repository executes DB work,
6. audit/domain events written,
7. response returns safe DTO.

## 6. Authentication

Do not implement identity by trusting `userId` from the browser.

Preferred rule:
- use a mature authentication library/provider,
- server validates session,
- secure cookies for browser sessions where appropriate,
- roles loaded from trusted DB state,
- admin MFA before privileged operations.

## 7. Turso role

Turso/libSQL is the **temporary startup persistence layer**.

It is not a reason to couple product logic to SQLite.

Keep:
- SQL in migrations/repositories,
- portable identifiers,
- integer money,
- explicit foreign keys,
- conservative SQL features,
- export/reconciliation tooling.

## 8. Future database migration

A future move to PostgreSQL should primarily replace:
- repository implementations,
- migrations,
- database-specific concurrency controls,
- optional RLS layer.

UI/API/domain contracts should remain stable.

## 9. Mobile architecture

Do not create separate business logic per platform.

Future native:
```text
React Native/Expo app
       |
same HTTPS API
       |
same services/domain
```

PWA remains useful for low-friction acquisition.

## 10. Background work

Use job processing for:
- webhook retries,
- notification delivery,
- inspection expiry,
- scheduled release evaluation,
- payout retry,
- reconciliation,
- risk checks.

Never use a frontend timer as the authority for automatic release.

## 11. Observability

Structured logs with:
- request ID,
- actor ID where permitted,
- transaction ID,
- provider event ID,
- action/outcome,
- latency,
- error code.

Do not log:
- passwords,
- OTP plaintext,
- full secrets,
- raw sensitive evidence.



---


# 10 — Database Architecture

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Database strategy

**Current startup database:** Turso/libSQL (SQLite-compatible).  
**Future option:** managed PostgreSQL when scale, reporting, concurrency, partner requirements or operational maturity justify it.

Turso does not provide PostgreSQL-style RLS. Therefore sensitive authorization belongs in the trusted API/service layer.

## 2. Global conventions

- IDs: UUID/ULID-style TEXT.
- timestamps: UTC, consistent representation.
- money: INTEGER minor units.
- currency: ISO 4217 code, e.g. NGN.
- foreign keys enabled.
- indexes on all common relationship/search paths.
- no authoritative FLOAT/REAL money.
- migrations tracked and immutable after deployment.

## 3. Identity

### profiles
- id PK
- email/phone identifiers as appropriate
- display_name
- full_name
- country
- avatar reference
- onboarded
- created_at / updated_at

### user_roles
- id PK
- user_id FK
- role
- created_at
- unique(user_id, role)

Roles:
buyer, seller, merchant, support, dispute_agent, operations, finance, super_admin.

### auth_sessions
If self-hosted/library auth persists sessions locally:
- id
- user_id
- token/session hash
- expires_at
- revoked_at
- created_at
- last_seen_at
- device/risk metadata

Prefer framework-managed schema if using a mature auth library.

## 4. Legal/terms

### terms_versions
Immutable terms version metadata.

### terms_acceptances
- terms_version_id
- user_id
- optional transaction_id
- accepted_at
- IP/user agent where law/policy permits.

## 5. Transactions

### transactions
Core fields:
- id
- public_id unique
- invite_slug unique
- seller_id
- buyer_id nullable until acceptance
- title/description/category
- currency
- amount_minor
- delivery_fee_minor
- platform_fee_minor
- total_minor
- status
- inspection_deadline
- expires_at
- timestamps

Checks:
- amounts >= 0
- total equation enforced where practical.
- valid status list.

### transaction_participants
Unique(transaction_id, user_id).

### transaction_items
- quantity > 0
- unit_amount_minor >= 0.

### transaction_media
Metadata only; private object storage holds actual files.

### transaction_status_history
Append-only logical history:
- old state,
- new state,
- actor,
- reason,
- metadata,
- timestamp.

## 6. Payment

### payment_intents
- transaction_id
- payer_id
- provider
- provider_reference unique where applicable
- amount_minor
- currency
- status
- idempotency_key unique
- timestamps

### payment_events
Provider lifecycle events attached to payment intent.

### provider_webhook_events
- provider_event_id unique
- signature_verified
- raw payload or protected subset
- processing status
- received/processed time.

A unique provider event ID is essential for webhook idempotency.

## 7. Ledger

### ledger_accounts
Chart of accounts.

### ledger_transactions
One accounting event.

### ledger_entries
Debit/credit legs.

Invariant:
**sum debits = sum credits for every ledger transaction.**

Historical entries are not edited. Corrections use reversals.

## 8. Delivery

### deliveries
One active delivery record per goods transaction.

### delivery_events
Append event history.

### delivery_otps
- code digest only
- salt/nonce if design uses it
- expires_at
- attempts
- max_attempts
- used_at.

Never store OTP plaintext.

## 9. Messaging

### transaction_threads
Usually one thread per transaction.

### transaction_messages
- sender nullable for system event,
- message_type,
- body,
- metadata,
- timestamp.

Message types:
USER, SYSTEM, PAYMENT_EVENT, DELIVERY_EVENT, DISPUTE_EVENT, SETTLEMENT_EVENT.

### message_attachments
Private storage reference + MIME/size.

### message_read_states
Composite unique(message_id, user_id).

## 10. Disputes

### disputes
- transaction_id
- opened_by
- category
- reason
- status
- resolution
- resolved_by
- timestamps.

Partial unique rule should prevent more than one open dispute for the same transaction where SQLite indexing supports it.

### dispute_messages
Case-specific discussion.

### dispute_evidence
Private evidence metadata.

## 11. Settlement/refund

### settlements
- transaction_id
- seller_id
- amount_minor
- status
- provider reference
- idempotency key.

Protect against duplicate successful settlement.

### refunds
- transaction_id
- payment_intent_id
- amount_minor > 0
- status
- reason
- idempotency key.

Service transaction must ensure:
existing pending/successful refunds + new refund <= refundable remainder.

## 12. Operations

### notifications
User lifecycle notifications.

### audit_logs
Append-only security/operational events.

### admin_notes
Staff notes, never silently rewritten without history if they influence decisions.

### risk_flags
User/transaction flags with severity/status/resolution.

## 13. Important indexes

- transactions(seller_id, status, created_at)
- transactions(buyer_id, status, created_at)
- transactions(public_id)
- transactions(invite_slug)
- transaction_participants(user_id, transaction_id)
- messages(thread_id, created_at)
- disputes(status, created_at)
- payment_intents(transaction_id)
- provider_webhook_events(provider, provider_event_id)
- settlements(transaction_id, status)
- refunds(transaction_id, status)
- audit_logs(entity_type, entity_id, created_at)

## 14. Concurrency

Turso/SQLite differs from PostgreSQL. Financial services must be designed around short database transactions, idempotency and serialization strategies supported by the chosen deployment mode.

Before live money, concurrency tests must cover:
- two settlement requests,
- two refund requests,
- duplicate webhook delivery,
- accept + dispute race,
- automatic release + dispute race.

## 15. Data migration readiness

Maintain export tools capable of:
- stable IDs,
- row counts,
- foreign-key validation,
- money reconciliation,
- status mapping,
- ledger balance checks.

That is the bridge to PostgreSQL later.



---


# 11 — Security Architecture

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Security objective

No system can honestly promise “unhackable.” The goal is to:
- reduce attack surface,
- prevent common failures,
- limit blast radius,
- detect abuse quickly,
- recover safely,
- preserve evidence.

## 2. Threat model

Primary threats:
- account takeover,
- session theft,
- role escalation,
- IDOR/broken object authorization,
- fake payment confirmation,
- webhook forgery/replay,
- duplicate refund/settlement,
- dispute abuse,
- OTP brute force,
- evidence malware,
- secret leakage,
- admin compromise,
- database exfiltration,
- dependency compromise,
- denial of service,
- insider misuse.

## 3. Authentication

- use mature auth library/provider.
- passwordless OTP or passwords must have rate limits.
- secure browser sessions.
- HttpOnly cookies when cookie sessions are used.
- Secure in HTTPS.
- appropriate SameSite and CSRF protections.
- session expiry and revocation.
- re-authentication/MFA for high-risk admin actions.

## 4. Authorization

Turso has no PostgreSQL RLS equivalent for this architecture.

Every sensitive endpoint must call server authorization logic.

Reusable guards:
- requireUser
- requireTransactionParticipant
- requireBuyer
- requireSeller
- requireRole
- requireStaff
- requireDisputeAgent
- requireFinanceRole

Never trust:
- client userId,
- client role,
- hidden UI,
- localStorage role,
- URL parameter ownership.

## 5. Object authorization

Every resource lookup must be scoped:
- transaction belongs to participant or authorized staff.
- message belongs to visible transaction.
- evidence belongs to case/transaction.
- notification belongs to user.
- admin financial routes require finance-capable role.

## 6. Payment security

- secret keys server-only.
- signed webhook verification.
- unique provider event ID.
- idempotency keys.
- server-side payment verification.
- redirects are UX only, not proof.
- provider payload stored safely for audit.
- sandbox first.

## 7. Financial invariants

- integer minor units.
- double-entry ledger before live scale.
- no over-refund.
- no double settlement.
- dispute freezes release.
- immutable audit.
- transactional state transitions.

## 8. OTP

Delivery OTP:
- cryptographically secure RNG,
- HMAC keyed with server secret,
- expiry,
- attempts,
- rate limit,
- single use,
- timing-safe comparison.

Auth OTP and delivery OTP must use separate secrets/domains.

## 9. File/evidence security

- private bucket/storage.
- random object keys.
- content-type validation.
- extension validation.
- size limits.
- malware scanning integration.
- signed temporary download URLs.
- authorization before URL issuance.
- image metadata stripping where appropriate.

## 10. Web application security

- strict CSP as deployment permits.
- HSTS on HTTPS production.
- secure headers.
- output encoding.
- no unsafe HTML rendering.
- CSRF defense.
- CORS allowlist.
- request size limits.
- rate limiting.
- dependency scanning.
- source maps controlled.
- no secrets in VITE_*.

## 11. API security

- schema validation on every write.
- standardized error codes.
- no stack traces to clients.
- request IDs.
- authentication before authorization.
- idempotency for financial actions.
- anti-replay for webhooks.
- pagination and maximum limits.

## 12. Admin security

- MFA mandatory before real-money privileged access.
- separate staff role model.
- least privilege.
- reason required for sensitive actions.
- confirmation for refund/settlement overrides.
- audit of role changes.
- periodic access review.
- emergency “freeze financial operations” control.

## 13. Secrets

Secrets live in deployment secret manager/env, never:
- Git,
- chat prompts,
- frontend bundle,
- docs,
- logs.

Rotate immediately if exposed.

## 14. Privacy

- data minimization.
- role-scoped access.
- retention schedule.
- deletion/anonymization policy compatible with legal/financial record duties.
- privacy notices.
- data-subject request process.
- cross-border/data processor review.

## 15. Monitoring

Alert on:
- repeated OTP failures,
- unusual login activity,
- role changes,
- refund spikes,
- settlement failures,
- webhook signature failures,
- multiple accounts using same payout destination,
- rapid transaction velocity,
- repeated disputes.

## 16. Incident response

Minimum:
1. identify,
2. contain,
3. preserve logs,
4. rotate credentials if affected,
5. freeze risky financial paths,
6. assess customer/regulatory impact,
7. recover,
8. post-incident review.

## 17. Launch security gates

Before real money:
- independent security review,
- auth/session penetration testing,
- webhook test suite,
- financial race-condition tests,
- admin MFA,
- secrets scan,
- dependency audit,
- backups/restore test,
- incident contacts,
- payment partner approval,
- legal/compliance review.



---


# 12 — API Specification

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. API principles

- JSON over HTTPS.
- version prefix `/api/v1`.
- authenticated identity comes from server-validated session.
- request bodies never choose authoritative actor ID.
- predictable error envelope.
- idempotency for financial actions.
- pagination for lists.

## 2. Error envelope

```json
{
  "error": {
    "code": "TRANSACTION_NOT_ELIGIBLE",
    "message": "This transaction cannot be accepted in its current state.",
    "requestId": "req_..."
  }
}
```

Do not expose stack traces.

## 3. Auth

### GET /api/v1/auth/me
Returns safe authenticated user/profile/roles.

### POST /api/v1/auth/logout
Revokes current session.

Auth implementation may expose additional provider-specific endpoints but should remain behind a stable frontend auth client.

## 4. Transactions

### POST /api/v1/transactions
Create seller draft.

### GET /api/v1/transactions
Current user’s transactions, filtered/paginated.

### GET /api/v1/transactions/:publicId
Participant-visible transaction DTO.

### GET /api/v1/invites/:slug
Minimum safe pre-acceptance transaction preview.

### POST /api/v1/invites/:slug/accept
Authenticated buyer accepts transaction + terms.

### PATCH /api/v1/transactions/:id/draft
Seller can edit only eligible DRAFT fields.

### POST /api/v1/transactions/:id/cancel
Policy-controlled cancellation.

## 5. Payments

### POST /api/v1/transactions/:id/payment-intents
Creates provider payment intent.

### GET /api/v1/transactions/:id/payment
Safe payment status.

### POST /api/v1/webhooks/payments/:provider
Provider webhook endpoint.
Requirements:
- verify signature,
- dedupe event,
- process idempotently,
- update payment/transaction state transactionally,
- return provider-compatible status.

## 6. Delivery

### POST /api/v1/transactions/:id/dispatch
Seller dispatches with delivery metadata.

### POST /api/v1/transactions/:id/delivery-otp
Generate eligible OTP if workflow requires it.

### POST /api/v1/transactions/:id/delivery-otp/verify
Verify; does not directly release funds.

### POST /api/v1/transactions/:id/delivered
Trusted flow records delivery and starts inspection window.

## 7. Acceptance

### POST /api/v1/transactions/:id/accept-delivery
Buyer confirms acceptable delivery.
Server checks:
- actor is buyer,
- state eligible,
- no open dispute,
- delivery evidence/state valid.

## 8. Messaging

### GET /api/v1/transactions/:id/messages
Participant/staff-scoped paginated messages.

### POST /api/v1/transactions/:id/messages
User message only.

System messages are created internally, never by ordinary clients.

### POST /api/v1/transactions/:id/attachments/presign
Returns short-lived upload authorization after ownership/type/size checks.

## 9. Disputes

### POST /api/v1/transactions/:id/disputes
Open eligible dispute.

### GET /api/v1/disputes/:id
Participant or authorized staff.

### POST /api/v1/disputes/:id/messages
Case message.

### POST /api/v1/disputes/:id/evidence/presign
Private evidence upload.

## 10. Admin

### GET /api/v1/admin/overview
Operations metrics.

### GET /api/v1/admin/transactions
Authorized search/filter.

### GET /api/v1/admin/disputes
Case queue.

### POST /api/v1/admin/disputes/:id/resolve
Requires dispute role, reason, structured resolution.

### POST /api/v1/admin/refunds
Finance/dispute policy.

### POST /api/v1/admin/settlements/:id/retry
Finance only.

### POST /api/v1/admin/users/:id/roles
Super-admin only, audited.

## 11. Idempotency

Require `Idempotency-Key` for:
- payment intent creation,
- refunds,
- settlements,
- external payout initiation,
- other retryable money operations.

Store:
- key,
- actor,
- endpoint/action,
- request hash,
- result reference,
- expiry/retention.

## 12. Webhook contract

Provider adapters normalize external events into internal domain events such as:
- PAYMENT_SUCCEEDED
- PAYMENT_FAILED
- REFUND_SUCCEEDED
- REFUND_FAILED
- PAYOUT_SUCCEEDED
- PAYOUT_FAILED.

The rest of DealSure should not depend on provider-specific event names.

## 13. API evolution

- additive changes preferred.
- no silent semantic change to financial status.
- document deprecations.
- merchant API later receives separate keys/scopes/rate limits from consumer sessions.



---


# 13 — Engineering Standards

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Language and type safety

- TypeScript strict mode.
- no `any` unless documented boundary.
- runtime validation for external input.
- generated/shared DTO types where practical.
- avoid duplicating database schema types manually.

## 2. Layering

React component → client API → route → service → repository → database/provider.

Do not:
- execute SQL in React,
- call payment providers from browser with secrets,
- put complex business rules in route handlers.

## 3. Money

- integer minor units only.
- helper type/name conventions: `amountMinor`.
- formatting happens at display boundary.
- no `parseFloat` for authoritative money.

## 4. Dates

- store UTC.
- timezone conversion only for display/business policy.
- timer expiry decisions run on server.

## 5. Error handling

Use domain errors:
- Unauthorized
- Forbidden
- NotFound
- Conflict
- InvalidTransition
- IdempotencyConflict
- ProviderUnavailable.

Never leak raw DB/provider error messages to customers.

## 6. Logging

Structured JSON in production.
Fields:
- level,
- timestamp,
- requestId,
- action,
- transactionId,
- userId where safe,
- outcome,
- duration.

Redact secrets and sensitive payloads.

## 7. SQL/migrations

- one-way immutable history after deployment.
- migration naming sequence.
- foreign keys.
- explicit indexes.
- comments for unusual financial constraints.
- seed data separate and environment-guarded.

## 8. Git

- feature branches.
- small logical commits.
- review before main.
- no secrets.
- no generated build artifacts unless intentional.
- architecture decisions updated when material.

## 9. Dependencies

- prefer maintained packages.
- lockfile committed.
- dependency audit.
- avoid adding libraries for trivial utilities.
- review auth/payment/security libraries carefully.

## 10. Testing expectation

Every financial or security bug fix receives a regression test.

## 11. UI

- shared design primitives.
- accessible form components.
- semantic status mapping.
- responsive-first.
- no product state encoded only in color.

## 12. Documentation

Every major subsystem should answer:
- purpose,
- owner,
- inputs/outputs,
- data model,
- failure modes,
- security assumptions,
- tests,
- operational alerts.



---


# 14 — Infrastructure Guide

**Research snapshot:** 2026-09-09

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Startup principle

Optimize for:
- low fixed cost,
- simple operations,
- portability,
- clear upgrade path.

Do not optimize for hypothetical millions of users by adding systems the team cannot operate.

## 2. Current recommended environment model

### Development
- Google AI Studio/local workspace.
- Turso development database.
- sandbox/mock payment provider.
- test email/SMS.
- synthetic data.

### Staging
- separate database.
- production-like auth.
- provider sandbox.
- real deployment topology.
- no customer money.

### Production
- separate secrets/accounts/database.
- approved payment partner.
- monitoring/backups.
- staff MFA.
- deployment controls.

## 3. Turso temporary database

As of the research snapshot, Turso’s published free plan lists:
- 100 databases,
- 5 GB storage,
- 500 million row reads/month,
- 10 million row writes/month,
- 3 GB monthly sync,
- 1-day point-in-time restore.

This is generous for an early MVP, but capacity planning must be based on measured workload rather than user count alone.

The first likely constraints may be:
- write volume from chat/system events,
- evidence/file storage (which should not live inside the DB),
- auth/notification provider quotas,
- payment-provider costs,
- operational support.

## 4. File storage

Do not store evidence binaries directly in Turso.

Use object storage:
- private by default,
- signed URLs,
- lifecycle/retention,
- malware scanning integration.

## 5. Shared hosting

Traditional shared hosting often offers MySQL/MariaDB and PHP; Node support varies.

DealSure should not choose infrastructure solely because the host bundles a database. The trusted Node API, background jobs, secrets and webhook reliability matter more.

Suitable deployment must support:
- Node runtime,
- HTTPS,
- environment secrets,
- outbound HTTPS,
- incoming webhooks,
- persistent process/serverless functions,
- scheduled/background jobs,
- logs.

## 6. Deployment

Pipeline:
1. test,
2. typecheck,
3. lint,
4. build,
5. migration step,
6. deploy,
7. health check,
8. smoke test.

Production migrations should not silently race on every app startup.

## 7. Backups

- database PITR/backups per provider.
- periodic logical export.
- evidence storage versioning/retention.
- restore drill.
- documented RPO/RTO later.

## 8. Monitoring

Monitor:
- API error rate,
- latency,
- database errors,
- webhook failures,
- job retries,
- payment mismatch,
- settlement failure,
- dispute backlog,
- auth anomalies.

## 9. Scaling path

### Stage A — MVP
One application/API deployment + Turso + managed external services.

### Stage B — traction
Separate workers, queues, caching where measured, improved observability.

### Stage C — financial scale
Re-evaluate database, payment architecture, ledger/reporting and region/compliance needs. PostgreSQL becomes a strong candidate.

## Sources

- Turso pricing: https://turso.tech/pricing
- Turso product: https://turso.tech/



---


# 15 — AI Development Manual

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Purpose

AI coding agents accelerate implementation but must not become the source of truth.

The source of truth is:
1. product docs,
2. architecture docs,
3. security rules,
4. tests,
5. reviewed code.

## 2. Context pack for every major AI task

Tell the agent:
- product purpose,
- current architecture,
- exact scope,
- files/folders it may change,
- security constraints,
- non-goals,
- tests to run,
- stop conditions.

## 3. Standard prompt structure

```text
ROLE
Act as senior engineer for DealSure.

OBJECTIVE
Implement exactly [feature].

SOURCE OF TRUTH
Read docs [specific files] before coding.

SCOPE
Allowed files/modules: [...]

DO NOT
- rewrite unrelated code
- weaken auth
- expose secrets
- bypass tests
- change financial state from frontend

SECURITY RULES
[list relevant invariants]

IMPLEMENTATION PLAN
First inspect and report. Then implement incrementally.

QUALITY GATES
typecheck, lint, tests, build, security review.

STOP CONDITIONS
Stop on ambiguity involving money, auth, data loss, secrets or legal custody.
```

## 4. AI task sizing

Good AI task:
- one subsystem,
- one migration,
- one flow,
- one security review.

Bad AI task:
“Build the entire fintech and fix everything.”

## 5. Two-pass rule

For sensitive work:
1. implementation agent,
2. independent review prompt/agent.

Security review should actively attempt to break assumptions.

## 6. Database prompts

Require:
- constraints,
- indexes,
- migration safety,
- rollback/forward strategy,
- idempotency,
- concurrency notes,
- no data loss.

## 7. Auth prompts

Require explanation of:
- identity source,
- session storage,
- expiry,
- revocation,
- role source,
- CSRF,
- rate limits,
- negative authorization tests.

## 8. Financial prompts

Always include:
- client cannot assert success,
- provider webhook validation,
- idempotency,
- integer money,
- ledger/reconciliation,
- race tests,
- dispute freeze.

## 9. UI prompts

Tell AI to:
- preserve business logic,
- use design system,
- improve hierarchy,
- test mobile,
- avoid copied proprietary designs,
- retain accessibility.

## 10. Review checklist for AI output

Ask:
- What changed?
- Why?
- What did you not change?
- What assumptions remain?
- What security boundaries exist?
- Which tests ran?
- What failed?
- What would break under concurrency?
- Are there new secrets?
- Are migrations safe?

## 11. Never allow autonomous actions without review

Require human review before:
- production migration,
- live payment configuration,
- deleting data,
- changing admin roles,
- refund/settlement logic,
- legal copy claiming custody/licensing.



---


# 16 — Security Review Playbook

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Review cadence

Run security review:
- before merge of auth/payment/admin work,
- before staging,
- before live-money pilot,
- after major dependency/provider change,
- after incident.

## 2. Threat-model worksheet

For each feature:
- assets,
- actors,
- trust boundaries,
- entry points,
- abusive user goals,
- privileged operations,
- logs/evidence,
- failure containment.

## 3. Authentication review

Test:
- no-auth access,
- expired session,
- revoked session,
- stolen/modified cookie,
- OTP brute force,
- account enumeration,
- session fixation,
- logout.

## 4. Authorization review

For every endpoint:
- unrelated user,
- buyer acting as seller,
- seller acting as buyer,
- support acting as finance,
- normal user acting as admin,
- object ID swap,
- direct API call bypassing UI.

## 5. Payment review

- forged webhook,
- replay webhook,
- duplicate event,
- redirect without webhook,
- wrong amount/currency,
- provider timeout,
- refund duplicate,
- payout duplicate.

## 6. Transaction review

- invalid state transition,
- stale state,
- dispute + release race,
- cancelled + payment webhook race,
- buyer accepts someone else’s transaction,
- invite slug enumeration.

## 7. Evidence/storage review

- executable upload,
- MIME mismatch,
- huge file,
- path/key manipulation,
- unauthorized signed URL,
- metadata privacy leak.

## 8. Admin review

- role escalation,
- missing reason,
- unaudited action,
- overly broad support access,
- finance action without MFA,
- audit deletion.

## 9. Dependency/code review

- secret scanning,
- npm audit/advisories,
- vulnerable auth package,
- unsafe eval/HTML,
- SSRF-capable URL fetch,
- SQL injection,
- command injection.

## 10. Release gate

No live-money release with unresolved critical/high findings affecting:
- auth,
- authorization,
- payment verification,
- refund/settlement,
- ledger,
- secrets,
- admin access,
- evidence privacy.



---


# 17 — Testing Manual

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Test pyramid

### Unit
- state transition rules,
- fee calculations,
- refund remainder,
- OTP helper,
- permission helpers,
- DTO validation.

### Integration
- repositories + Turso,
- API + auth,
- webhook processing,
- migrations,
- financial transactions.

### E2E
- browser/mobile flows through API.

## 2. Golden-path E2E

Seller creates  
→ buyer reviews  
→ buyer authenticates  
→ accepts  
→ sandbox payment  
→ server verifies  
→ payment secured  
→ seller dispatches  
→ delivery  
→ inspection  
→ buyer accepts  
→ settlement simulation.

## 3. Dispute E2E

Payment secured  
→ delivery  
→ buyer disputes  
→ evidence/messages  
→ payout frozen  
→ staff reviews  
→ authorized refund or release  
→ audit updated.

## 4. Authorization matrix tests

Test every role against:
- transaction read/write,
- messages,
- evidence,
- disputes,
- refund,
- settlement,
- admin roles,
- audit.

## 5. Financial tests

- amount boundaries,
- integer money,
- wrong currency,
- duplicate webhook,
- duplicate idempotency key,
- two simultaneous refunds,
- over-refund,
- two simultaneous settlements,
- unbalanced ledger rejected,
- reversal accounting.

## 6. State-machine tests

Every allowed transition.
Every disallowed transition.
Terminal-state behavior.
Dispute branch.
Expiry branch.

## 7. Migration tests

On clean DB:
- all migrations apply.
- foreign keys on.
- seed only in dev.
- indexes exist.

Upgrade test:
- migrate from previous schema snapshot.

## 8. Performance tests

Measure:
- transaction list,
- workspace,
- message pagination,
- admin queue,
- webhook burst.

Do not set arbitrary scale goals; establish baseline and target from expected pilot load.

## 9. Security tests

- IDOR,
- role forging,
- CSRF,
- brute force,
- rate limiting,
- upload abuse,
- header/cookie tampering.

## 10. Mobile/PWA

- installability,
- offline shell,
- reconnect behavior,
- safe-area,
- keyboard/forms,
- update handling.

No financial mutation should “complete offline.”

## 11. Definition of done

Feature is not done until:
- tests pass,
- negative authorization tests exist,
- logging/audit is sufficient,
- docs updated,
- error/empty/loading states exist.



---


# 18 — Operations Manual

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

## 1. Operating principle

Financial/trust operations must be explainable from logs, audit history and provider records.

## 2. Daily operations dashboard

Monitor:
- payment processing backlog,
- secured transactions,
- deliveries awaiting action,
- inspection deadlines,
- open disputes,
- refund queue,
- settlement queue,
- payout failures,
- webhook failures,
- risk flags,
- system errors.

## 3. Dispute runbook

1. Confirm transaction is frozen.
2. Verify parties/identity context.
3. Review agreed terms.
4. Review system timeline.
5. Review delivery evidence.
6. Review messages/evidence.
7. Request additional evidence if policy permits.
8. Apply published dispute policy.
9. Record structured resolution/reason.
10. Trigger authorized refund/release.
11. Audit action and notify parties.

## 4. Payment webhook outage

- alert,
- stop assuming frontend success,
- queue/retry provider verification,
- reconcile pending intents,
- communicate degraded status,
- never manually mark bulk transactions successful without provider evidence.

## 5. Settlement failure

- transaction remains in safe pending state,
- log provider failure,
- do not duplicate payout automatically without idempotency,
- verify destination/account,
- retry through controlled job,
- notify finance if threshold exceeded.

## 6. Suspected fraud

- freeze affected transaction/account actions according to policy,
- preserve evidence,
- restrict payout if authorized,
- escalate to risk/compliance,
- do not delete data,
- record reason and actor.

## 7. Database incident

- stop risky writes if integrity is uncertain,
- preserve logs,
- assess last known good state,
- restore only after verifying backups,
- reconcile payment-provider events after recovery.

## 8. Credential leak

- revoke/rotate credential,
- identify exposure scope,
- inspect logs/use,
- update deployments,
- invalidate affected sessions if needed,
- incident review.

## 9. Customer support doctrine

Support must distinguish:
- product explanation,
- payment provider issue,
- delivery issue,
- dispute issue,
- security incident.

Do not promise a refund/release before the authorized decision.

## 10. Operational roles

Support: customer assistance, no financial override.  
Dispute agent: case resolution within policy.  
Operations: workflow/system operations.  
Finance: refund/settlement/reconciliation.  
Super admin: role/system control, heavily restricted.

## 11. Business continuity

Maintain:
- provider contacts,
- legal/compliance contacts,
- incident channel,
- backup/restore instructions,
- rollback plan,
- status-page communication template.



---


# 19 — Decision Register

**Status date:** 2026-09-09

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

| ID | Decision | Status | Rationale | Revisit trigger |
|---|---|---|---|---|
| ADR-001 | Treat DealSure as trust orchestration, not merely escrow checkout | Accepted | Differentiation comes from whole lifecycle | Product-market evidence |
| ADR-002 | DealSure remains working name pending clearance | Accepted | Avoid premature brand lock-in | Before public launch |
| ADR-003 | Mobile-first PWA + web now; native later | Accepted | Low-cost distribution and shared code | Native capability gaps |
| ADR-004 | Trusted server is authoritative for money/state | Accepted | Browser cannot be trusted for financial state | Never unless architecture fundamentally changes |
| ADR-005 | Turso/libSQL is temporary startup DB | Accepted | Low cost/simple startup | Concurrency, reporting, compliance or scale needs |
| ADR-006 | Keep repository/service abstraction for DB portability | Accepted | Future Postgres migration | Never unless unnecessary complexity proven |
| ADR-007 | No PostgreSQL RLS in Turso architecture; enforce server authorization | Accepted | Platform capability difference | If migrating to Postgres |
| ADR-008 | Integer minor units for money | Accepted | Avoid floating-point financial error | Never |
| ADR-009 | Payment provider abstraction | Accepted | Avoid vendor lock-in | Provider strategy review |
| ADR-010 | Do not claim licensed escrow without confirmation | Accepted | Legal/custody risk | Legal/partner approval |
| ADR-011 | OTP is supporting evidence, not sole release condition | Accepted | Prevent weak proof from moving money | Policy/legal review |
| ADR-012 | Append-only transaction/audit/ledger history | Accepted | Investigation/reconciliation | Never for financial history |
| ADR-013 | Supabase/Postgres work preserved as future reference, not current runtime | Accepted | Prior design investment remains useful | Database migration |
| ADR-014 | No production payment credentials during foundation | Accepted | Safety | Live-money launch gate |
| ADR-015 | AI assists implementation but cannot silently change architecture | Accepted | Control drift | Ongoing |
| ADR-016 | Admin is role-based authorization, not a separate consumer identity universe | Accepted | Simpler identity, least privilege | Enterprise security review |
| ADR-017 | Future reputation must be explainable | Accepted | Avoid opaque/unfair scoring | Reputation implementation |
| ADR-018 | Transaction messages + system events share one workspace but different authority | Accepted | Strong evidence/trust UX | Messaging implementation |
| ADR-019 | Migrations are explicit deployment step in production | Proposed | Avoid startup race | Before production deploy |
| ADR-020 | Auth implementation must use mature library/provider | Proposed | Avoid homegrown session risk | Before transaction writes |



---


# 20 — Product Roadmap

**Working-name note:** “DealSure” is used throughout this suite as a working product name. Treat brand clearance, CAC name reservation, trademark clearance, domain and handle checks as a separate pre-launch workstream before public launch.

The roadmap is **gate-based**, not date fantasy. Advance when security, product and operational evidence supports it.

## Phase 0 — Foundation (current)

Goal: make the codebase structurally safe to continue.

Deliver:
- React/PWA baseline,
- trusted Node server,
- Turso development database,
- migrations,
- repository/service contracts,
- transaction state machine,
- auth decision,
- role model,
- security docs,
- synthetic fixtures,
- CI quality gates.

Exit gate:
- clean migration test,
- auth/session architecture approved,
- authorization negative tests,
- no secrets in frontend/source.

## MVP — Protected transaction pilot

Goal: one excellent end-to-end transaction.

Deliver:
- account/profile,
- seller create,
- buyer invite/review,
- terms acceptance,
- sandbox payment,
- payment secured state,
- dispatch/delivery,
- inspection,
- transaction messaging,
- dispute,
- admin resolution,
- settlement/refund simulation,
- notifications,
- audit.

Exit gate:
- golden-path + dispute E2E green,
- security review,
- controlled pilot users,
- operational runbooks.

## Live-money pilot

Goal: small, tightly controlled real transactions.

Prerequisites:
- qualified Nigerian legal review,
- payment partner contract,
- approved funds flow,
- KYC/AML responsibilities defined,
- privacy compliance work,
- staff MFA,
- reconciliation,
- fraud limits,
- incident process,
- independent security testing.

Product:
- live payment provider adapter,
- live refund/settlement,
- transaction limits,
- manual risk review,
- customer support tooling.

## V1 — Nigerian social commerce product

Deliver:
- polished mobile experience,
- merchant profiles,
- reusable templates,
- stronger identity verification,
- delivery integration,
- push notifications,
- reputation history,
- operational analytics,
- improved dispute policy.

Growth:
- Instagram/WhatsApp seller acquisition,
- referral flows,
- merchant share links,
- trust-and-safety education.

## V2 — Merchant platform

Deliver:
- merchant teams,
- API keys,
- merchant webhooks,
- embedded protected checkout,
- milestone transactions,
- richer reporting,
- business verification,
- configurable workflows.

## V3 — Platform/marketplace infrastructure

Deliver:
- multi-party transactions,
- platform accounts,
- partner onboarding,
- API SLAs,
- enterprise audit,
- deeper fraud/risk,
- multi-currency where supported,
- regional compliance modules.

## Native mobile decision

Build dedicated iOS/Android when measured needs justify it:
- push/re-engagement,
- camera/evidence workflows,
- biometric secure session,
- performance,
- app-store distribution.

Do not duplicate backend logic in native apps.

## Database scale decision

Stay on Turso while it meets:
- reliability,
- concurrency,
- reporting,
- security,
- partner requirements,
- economics.

Evaluate PostgreSQL when:
- complex relational reporting becomes central,
- financial concurrency needs exceed comfortable SQLite patterns,
- data warehouse/BI needs grow,
- regulatory/partner expectations favor Postgres,
- team operational maturity supports migration.

## Long-term vision

DealSure evolves from consumer protected transactions into a trust infrastructure layer that other merchants and platforms can embed.



---


# Source Bibliography

Research snapshot: 2026-09-09

- Escrow.com: https://www.escrow.com/learn-more/how-escrow-works/how-escrow-works
- EscrowLock: https://www.escrowlock.com/
- Pandascrow Escrow: https://pandascrow.io/solutions/escrow
- Pandascrow API: https://pandascrow.readme.io/reference/escrow
- Online Payment Platform Marketplace: https://www.onlinepaymentplatform.com/for-who/by-type/marketplace
- Stripe Connect Marketplace: https://docs.stripe.com/connect/marketplace
- Stripe Separate Charges/Transfers: https://docs.stripe.com/connect/separate-charges-and-transfers
- Adyen for Platforms: https://docs.adyen.com/adyen-for-platforms-model/
- Paystack Split Payments: https://paystack.com/docs/payments/split-payments/
- Flutterwave Split Payments: https://developer.flutterwave.com/v3.0/docs/split-payments
- Monnify Marketplaces: https://monnify.com/use-cases/marketplaces
- Upwork Fixed-Price Protection: https://support.upwork.com/hc/en-us/articles/211063748-How-Fixed-Price-Payment-Protection-works-for-freelancers-on-Upwork
- eBay Money Back Guarantee: https://www.ebay.com/help/policies/ebay/ebay?id=4210
- CBN Payment Service Providers: https://www.cbn.gov.ng/PaymentsSystem/PSPs.html
- CBN Payments System: https://www.cbn.gov.ng/PaymentsSystem/
- NDPC NDP Act: https://www.ndpc.gov.ng/ndp-act-2023/
- NDPC FAQ: https://www.ndpc.gov.ng/faqs/
- Turso Pricing: https://turso.tech/pricing
- Turso: https://turso.tech/
