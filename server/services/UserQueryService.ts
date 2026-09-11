/**
 * UserQueryService — authorized profile reads (Phase 4, §22).
 * Own private profile vs public seller card. Sensitive fields (bank, KYC,
 * contact details, roles, risk) never enter the public DTO.
 */
import type { AuthenticatedPrincipal } from "../../src/lib/auth/types.js";
import { requireAuthenticated } from "../../src/lib/auth/policy.js";
import type { TursoUserRepository } from "../repositories/TursoUserRepository.js";
import type { ProfileDto, PublicSellerDto } from "../api/dto.js";

export class UserQueryService {
  private users: TursoUserRepository;

  constructor(users: TursoUserRepository) {
    this.users = users;
  }

  async myProfile(principal: AuthenticatedPrincipal | null): Promise<ProfileDto | null> {
    const me = requireAuthenticated(principal);
    const profile = await this.users.findProfileById(me.userId);
    if (profile === null) return null;
    const roles = await this.users.activeRoles(me.userId);
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      roles,
    };
  }

  async publicSeller(
    principal: AuthenticatedPrincipal | null,
    profileId: string,
  ): Promise<PublicSellerDto | null> {
    requireAuthenticated(principal);
    const profile = await this.users.findProfileById(profileId);
    if (profile === null) return null;
    return { profileId: profile.id, displayName: profile.displayName };
  }
}
