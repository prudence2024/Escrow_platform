/**
 * MessageRepository — transaction workspace communication (§37).
 * senderId NULL denotes a trusted SYSTEM event. Repository methods take an
 * explicit author/source argument; ordinary-user paths must never pass a
 * trusted message type — enforced by services.
 */

export type MessageType =
  | "USER"
  | "SYSTEM"
  | "PAYMENT_EVENT"
  | "DELIVERY_EVENT"
  | "DISPUTE_EVENT"
  | "SETTLEMENT_EVENT";

export interface TransactionMessage {
  id: string;
  threadId: string;
  senderId: string | null;
  messageType: MessageType;
  body: string;
  createdAt: number;
}

export interface MessageRepository {
  ensureThread(transactionId: string): Promise<string>;
  postMessage(input: Omit<TransactionMessage, "id" | "createdAt">): Promise<TransactionMessage>;
  listMessages(threadId: string, limit: number, before?: number): Promise<TransactionMessage[]>;
  addAttachment(messageId: string, storageKey: string, mimeType: string | null, sizeBytes: number | null): Promise<void>;
  markRead(messageId: string, profileId: string, readAt: number): Promise<void>;
}
