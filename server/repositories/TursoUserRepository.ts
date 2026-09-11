/**
 * Turso-backed UserRepository — READ methods implemented (Phase 4).
 * Identity writes (profile creation, role grants, KYC, bank accounts) stay
 * on Convex for now and throw here.
 */
import type { Client } from "@libsql/client";
import type {
  CanonicalRole,
  Profile,
  UserRepository,
} from "./interfaces/UserRepository.js";

const NOT_IMPLEMENTED =
  "Writes are not implemented in Phase 4 (Convex remains authoritative)";

type Row = Record<string, unknown>;

function toProfile(row: Row): Profile {
  return {
    id: String(row["id"]),
    email: row["email"] === null ? null : String(row["email"]),
    displayName: row["display_name"] === null ? null : String(row["display_name"]),
    fullName: row["full_name"] === null ? null : String(row["full_name"]),
    phone: row["phone"] === null ? null : String(row["phone"]),
    country: row["country"] === null ? null : String(row["country"]),
    onboarded: Number(row["onboarded"]) === 1,
    createdAt: Number(row["created_at"]),
    updatedAt: Number(row["updated_at"]),
  };
}

const PROFILE_COLUMNS =
  "id, email, display_name, full_name, phone, country, onboarded, created_at, updated_at";

export class TursoUserRepository implements UserRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async findProfileById(id: string): Promise<Profile | null> {
    const rs = await this.client.execute({
      sql: `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = ?`,
      args: [id],
    });
    const row = rs.rows[0] as Row | undefined;
    return row === undefined ? null : toProfile(row);
  }

  async findProfileByEmail(email: string): Promise<Profile | null> {
    const rs = await this.client.execute({
      sql: `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE email = ?`,
      args: [email],
    });
    const row = rs.rows[0] as Row | undefined;
    return row === undefined ? null : toProfile(row);
  }

  async activeRoles(profileId: string): Promise<CanonicalRole[]> {
    const rs = await this.client.execute({
      sql: "SELECT role FROM user_roles WHERE profile_id = ? AND revoked_at IS NULL ORDER BY role ASC",
      args: [profileId],
    });
    return (rs.rows as Row[]).map((row) => String(row["role"]) as CanonicalRole);
  }

  async createProfile(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async grantRole(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async revokeRole(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async recordTermsAcceptance(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async upsertKyc(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async addBankAccount(): Promise<never> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
