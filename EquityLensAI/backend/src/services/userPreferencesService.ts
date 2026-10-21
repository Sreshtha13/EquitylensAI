import { userRepository } from '../db/userRepository.js';
import type { UserPreferences } from '@equitylensai/shared';

export class UserPreferencesService {
  async getPreferences(userId: string): Promise<UserPreferences> {
    return userRepository.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    data: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>,
  ): Promise<UserPreferences> {
    const existing = await this.getPreferences(userId);

    const updated: UserPreferences = {
      ...existing,
      defaultExchange: data.defaultExchange ?? existing.defaultExchange,
      preferredCurrency: data.preferredCurrency ?? existing.preferredCurrency,
      preferredPeriod: data.preferredPeriod ?? existing.preferredPeriod,
      defaultLandingPage: data.defaultLandingPage ?? existing.defaultLandingPage,
      theme: data.theme ?? existing.theme,
      tableDensity: data.tableDensity ?? existing.tableDensity,
      updatedAt: new Date().toISOString(),
    };

    return userRepository.upsertPreferences(updated);
  }
}

export const userPreferencesService = new UserPreferencesService();
