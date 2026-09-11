/**
 * RiskRepository — transparent operational flags + staff notes (§37, §29–§30).
 * Flags are reviewable records with severity/status — never an opaque score.
 * Admin notes stay separate from participant-visible messages.
 */

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH";
export type RiskStatus = "OPEN" | "REVIEWED" | "CLEARED";

export interface RiskFlag {
  id: string;
  transactionId: string | null;
  profileId: string | null;
  type: string;
  severity: RiskSeverity;
  reason: string;
  source: string;
  status: RiskStatus;
  reviewedBy: string | null;
  reviewedAt: number | null;
  createdAt: number;
}

export interface RiskRepository {
  flag(input: Omit<RiskFlag, "id" | "status" | "reviewedBy" | "reviewedAt" | "createdAt">): Promise<RiskFlag>;
  review(id: string, status: RiskStatus, reviewedBy: string, reviewedAt: number): Promise<void>;
  openFlags(limit: number): Promise<RiskFlag[]>;
  addAdminNote(transactionId: string | null, authorId: string, body: string): Promise<void>;
  adminNotes(transactionId: string): Promise<Array<{ id: string; authorId: string; body: string; createdAt: number }>>;
}
