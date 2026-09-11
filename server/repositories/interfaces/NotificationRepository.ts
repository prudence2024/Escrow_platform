/**
 * NotificationRepository — server-authored user notifications (§37).
 * Clients may only advance read state, never rewrite authoritative content.
 */

export interface Notification {
  id: string;
  profileId: string;
  transactionId: string | null;
  type: string;
  title: string;
  body: string | null;
  readAt: number | null;
  createdAt: number;
}

export interface NotificationRepository {
  create(input: Omit<Notification, "id" | "readAt" | "createdAt">): Promise<Notification>;
  listForProfile(profileId: string, limit: number): Promise<Notification[]>;
  unreadCount(profileId: string): Promise<number>;
  markRead(id: string, profileId: string, readAt: number): Promise<void>;
  markAllRead(profileId: string, readAt: number): Promise<void>;
}
