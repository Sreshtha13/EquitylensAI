import { userRepository } from '../db/userRepository.js';
import type { UserProfile } from '@equitylensai/shared';

export class UserProfileService {
  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await userRepository.getProfile(userId);
    if (!profile) {
      // Create lazy profile
      const newProfile: UserProfile = {
        id: crypto.randomUUID(),
        authUserId: userId,
        email: '',
        displayName: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return userRepository.upsertProfile(newProfile);
    }
    return profile;
  }

  async updateProfile(
    userId: string,
    data: { displayName?: string | null; avatarUrl?: string | null },
  ): Promise<UserProfile> {
    const existing = await this.getProfile(userId);

    const updated: UserProfile = {
      ...existing,
      displayName: data.displayName !== undefined ? data.displayName : existing.displayName,
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
      updatedAt: new Date().toISOString(),
    };

    return userRepository.upsertProfile(updated);
  }
}

export const userProfileService = new UserProfileService();
