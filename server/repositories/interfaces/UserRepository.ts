/**
 * UserRepository — identity aggregate (Phase 3, §37).
 *
 * Covers profiles, user_roles, terms, KYC state, and bank/payout
 * destinations. Implementations must source roles from this store (never
 * from client input) and must never persist password hashes, refresh
 * tokens, or provider session secrets here.
 */

export type CanonicalRole =
  | "buyer"
  | "seller"
  | "merchant"
  | "support"
  | "dispute_agent"
  | "operations"
  | "finance"
  | "super_admin";

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  fullName: string | null;
  phone: string | null;
  country: string | null;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserRole {
  id: string;
  profileId: string;
  role: CanonicalRole;
  grantedBy: string | null;
  grantedAt: number;
  revokedAt: number | null;
}

export interface TermsAcceptance {
  id: string;
  profileId: string;
  termsVersionId: string;
  transactionId: string | null;
  acceptedAt: number;
}

export interface KycProfile {
  id: string;
  profileId: string;
  status: "UNVERIFIED" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  docType: string | null;
  documentReference: string | null;
  verifiedAt: number | null;
  rejectedReason: string | null;
}

export interface BankAccount {
  id: string;
  profileId: string;
  provider: string | null;
  providerRecipientReference: string | null;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  isDefault: boolean;
}

export interface UserRepository {
  findProfileById(id: string): Promise<Profile | null>;
  findProfileByEmail(email: string): Promise<Profile | null>;
  createProfile(input: Omit<Profile, "createdAt" | "updatedAt">): Promise<Profile>;
  activeRoles(profileId: string): Promise<CanonicalRole[]>;
  grantRole(profileId: string, role: CanonicalRole, grantedBy: string): Promise<UserRole>;
  revokeRole(profileId: string, role: CanonicalRole): Promise<void>;
  recordTermsAcceptance(input: Omit<TermsAcceptance, "id">): Promise<TermsAcceptance>;
  upsertKyc(input: Omit<KycProfile, "id">): Promise<KycProfile>;
  addBankAccount(input: Omit<BankAccount, "id" | "status">): Promise<BankAccount>;
}
