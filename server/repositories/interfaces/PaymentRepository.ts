/**
 * PaymentRepository — intents, provider events, webhook inbox (§37).
 * Sandbox/development scope: no live-provider behavior is assumed.
 */

export type PaymentIntentStatus = "PENDING" | "SECURED" | "REFUNDED" | "FAILED" | "CANCELLED";

export interface PaymentIntent {
  id: string;
  transactionId: string;
  payerId: string;
  provider: string;
  providerReference: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentIntentStatus;
  idempotencyKey: string;
  securedAt: number | null;
  createdAt: number;
}

export type WebhookProcessingStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "IGNORED_DUPLICATE";

export interface WebhookEvent {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  normalizedType: string | null;
  signatureVerified: boolean;
  processingStatus: WebhookProcessingStatus;
  receivedAt: number;
  processedAt: number | null;
  error: string | null;
}

export interface PaymentRepository {
  createIntent(input: Omit<PaymentIntent, "id" | "status" | "securedAt" | "createdAt">): Promise<PaymentIntent>;
  findIntentByIdempotency(transactionId: string, idempotencyKey: string): Promise<PaymentIntent | null>;
  findSecuredIntent(transactionId: string): Promise<PaymentIntent | null>;
  markIntentSecured(id: string, securedAt: number): Promise<PaymentIntent>;
  recordPaymentEvent(intentId: string, providerEventId: string, type: string): Promise<void>;
  /** Insert webhook receipt; duplicate (provider, event) must be reported, not duplicated. */
  receiveWebhook(input: Omit<WebhookEvent, "id" | "processingStatus" | "processedAt" | "error">): Promise<{ event: WebhookEvent; duplicate: boolean }>;
  markWebhookProcessed(id: string, normalizedType: string): Promise<void>;
  markWebhookFailed(id: string, error: string): Promise<void>;
}
