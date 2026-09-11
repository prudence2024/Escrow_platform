/**
 * DisputeRepository — cases, case messages, evidence metadata (§37).
 * Evidence references private object storage; bodies stay out of the DB.
 */

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REFUNDED" | "CLOSED";
export type DisputeResolution = "seller_settlement" | "buyer_refund" | "partial_refund";

export interface Dispute {
  id: string;
  transactionId: string;
  openedBy: string;
  category: string | null;
  reason: string;
  details: string | null;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: number | null;
  createdAt: number;
}

export interface DisputeRepository {
  open(input: Omit<Dispute, "id" | "status" | "resolution" | "resolutionNote" | "resolvedBy" | "resolvedAt" | "createdAt" | "updatedAt"> & { createdAt?: number }): Promise<Dispute>;
  findOpenByTransaction(transactionId: string): Promise<Dispute | null>;
  resolve(id: string, resolution: DisputeResolution, note: string | null, resolvedBy: string): Promise<Dispute>;
  postMessage(disputeId: string, authorId: string, body: string): Promise<void>;
  addEvidence(disputeId: string, uploaderId: string, storageKey: string | null, mimeType: string | null, sizeBytes: number | null): Promise<void>;
  queueByStatus(status: DisputeStatus, limit: number): Promise<Dispute[]>;
}
