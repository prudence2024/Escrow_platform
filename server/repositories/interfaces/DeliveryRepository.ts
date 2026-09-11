/**
 * DeliveryRepository — deliveries, events, hashed OTP rows (§37).
 * OTP rows carry digests only; plaintext must never reach this layer.
 */

export interface Delivery {
  id: string;
  transactionId: string;
  courierName: string | null;
  trackingNumber: string | null;
  carrierDetails: string | null;
  dispatchedAt: number | null;
  deliveredAt: number | null;
  inspectionDeadlineAt: number | null;
  status: "DISPATCHED" | "DELIVERED" | "CANCELLED" | null;
}

export interface DeliveryOtpRow {
  id: string;
  transactionId: string;
  deliveryId: string;
  codeDigest: string;
  context: string;
  expiresAt: number;
  attemptCount: number;
  maxAttempts: number;
  usedAt: number | null;
  createdAt: number;
}

export interface DeliveryRepository {
  createDelivery(input: Omit<Delivery, "id">): Promise<Delivery>;
  latestDelivery(transactionId: string): Promise<Delivery | null>;
  markDelivered(deliveryId: string, deliveredAt: number, inspectionDeadlineAt: number): Promise<void>;
  recordEvent(deliveryId: string, type: string, actorId: string | null, note?: string): Promise<void>;
  issueOtp(input: Omit<DeliveryOtpRow, "id" | "attemptCount" | "usedAt" | "createdAt">): Promise<DeliveryOtpRow>;
  latestOtp(transactionId: string): Promise<DeliveryOtpRow | null>;
  supersedeOpenOtps(transactionId: string, now: number): Promise<void>;
  bumpAttempts(id: string, attempts: number): Promise<void>;
  consumeOtp(id: string, now: number): Promise<void>;
}
