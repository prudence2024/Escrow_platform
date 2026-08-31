// Payment provider abstraction.
//
// DealSure never holds funds itself; real custody/controlled settlement must
// be an integration with a licensed bank/PSP/trustee. This abstraction is the
// seam where such an adapter plugs in. For dev/demo we ship MockPaymentProvider
// which simulates signed webhooks and settlement/refund confirmation.
//
// NOTE: a normal gateway collection API ≠ escrow. An adapter for a licensed
// partner accounts for control boundaries and stays behind this interface.

export type PaymentStatus =
  | "PENDING"
  | "SECURED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface InitInput {
  reference: string;
  amountKobo: number;
  currency: string;
  payerEmail?: string;
}
export interface WebhookInput {
  providerIntentId: string;
  events: "payment_success" | "payment_failed";
  providerEventId: string;
  raw: { amountKobo?: number };
}
export interface SettlementInput {
  reference: string;
  recipientAccountNumber: string;
  recipientBankCode: string;
  amountKobo: number;
  currency: string;
  meta?: unknown;
}
export interface RefundInput {
  reference: string;
  payerAccountNumber?: string;
  amountKobo: number;
  currency: string;
  meta?: unknown;
}

export interface PaymentProvider {
  readonly id: string;
  /**
   * Point-of-collection. Returns a provider intent + optional client
   * redirect/checkout URL. This DOES NOT confirm funds.
   */
  initializePayment(input: InitInput): Promise<{
    providerIntentId: string;
    redirectUrl: string | null;
  }>;
  /**
   * Server-side verification — the "webhook" equivalent. Server calls only;
   * treated as authoritative after event-id/amount checks.
   */
  handleWebhook(input: WebhookInput): Promise<{
    status: PaymentStatus;
    capturedAmountKobo: number;
  }>;
  requestSettlement(input: SettlementInput): Promise<{
    providerRef: string;
    status: "PENDING" | "PAID" | "FAILED";
  }>;
  requestRefund(input: RefundInput): Promise<{
    providerRef: string;
    status: "PENDING" | "PAID" | "FAILED";
  }>;
}

// Fictional but distinct event ids so idempotency/dedup can be demonstrated.
let seq = 0;
const nextEvent = () => `mpe_${Date.now()}_${seq++}`;

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";

  async initializePayment(input: InitInput) {
    const providerIntentId = `mpi_${input.reference}_${seq++}`;
    // In the reference flow the buyer would be redirected to a hosted checkout.
    return { providerIntentId, redirectUrl: null };
  }

  /** Simulates a signed provider webhook arriving asynchronously. */
  async handleWebhook(input: WebhookInput) {
    if (input.events === "payment_failed") {
      return { status: "FAILED" as PaymentStatus, capturedAmountKobo: 0 };
    }
    // payment_success — event id supplied by caller; captured amount validated
    // server-side against the intent so a mismatched amount is rejected.
    return {
      status: "SECURED" as PaymentStatus,
      capturedAmountKobo: input.raw?.amountKobo ?? 0,
    };
  }

  async requestSettlement(input: SettlementInput) {
    return {
      providerRef: nextEvent(),
      status: (input.amountKobo > 0 ? "PAID" : "FAILED") as "PAID" | "FAILED",
    };
  }

  async requestRefund(input: RefundInput) {
    return {
      providerRef: nextEvent(),
      status: (input.amountKobo > 0 ? "PAID" : "FAILED") as "PAID" | "FAILED",
    };
  }
}

const PROVIDERS = new Map<string, PaymentProvider>();
PROVIDERS.set("mock", new MockPaymentProvider());

export function getProvider(id: string): PaymentProvider {
  const p = PROVIDERS.get(id);
  if (!p) throw new Error(`Unknown payment provider: ${id}`);
  return p;
}