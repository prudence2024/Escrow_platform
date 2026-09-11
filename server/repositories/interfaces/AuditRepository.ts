/**
 * AuditRepository — append-only security/operational trail (§37, §28).
 * No update/delete operations exist by design. Never record passwords, OTP
 * plaintext, tokens, or secret keys — enforced by service call-sites.
 */

export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string | null;
  metadata: string | null;
  createdAt: number;
}

export interface AuditRepository {
  append(input: Omit<AuditEvent, "id" | "createdAt">): Promise<AuditEvent>;
  forEntity(entityType: string, entityId: string, limit: number): Promise<AuditEvent[]>;
  forActor(actorId: string, limit: number): Promise<AuditEvent[]>;
}
