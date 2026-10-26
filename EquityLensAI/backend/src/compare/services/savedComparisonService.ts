import crypto from 'node:crypto';
import type { SavedComparison, ComparisonCompanyTarget, SupportedPeriod } from '../types.js';
import { savedComparisonRepository } from '../repositories/savedComparisonRepository.js';
import { AppError } from '../../utils/appError.js';

export class SavedComparisonService {
  async listComparisons(userId: string): Promise<SavedComparison[]> {
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required to list saved comparisons', 401);
    }
    return savedComparisonRepository.listByUser(userId);
  }

  async getComparison(id: string, userId: string): Promise<SavedComparison> {
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const comparison = await savedComparisonRepository.getById(id, userId);
    if (!comparison) {
      throw new AppError('COMPARISON_NOT_FOUND', `Saved comparison ${id} not found`, 404);
    }

    return comparison;
  }

  async createComparison(
    userId: string,
    input: {
      name: string;
      description?: string | null;
      symbols: ComparisonCompanyTarget[];
      metrics?: string[];
      period?: SupportedPeriod;
      scope?: 'consolidated' | 'standalone';
    },
  ): Promise<SavedComparison> {
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authentication required to save comparisons', 401);
    }

    const trimmedName = input.name.trim();
    if (!trimmedName || trimmedName.length > 120) {
      throw new AppError('VALIDATION_ERROR', 'Comparison name must be between 1 and 120 characters', 400);
    }

    if (!input.symbols || input.symbols.length < 2) {
      throw new AppError('VALIDATION_ERROR', 'A comparison requires at least 2 companies', 400);
    }

    if (input.symbols.length > 5) {
      throw new AppError('VALIDATION_ERROR', 'A comparison can have at most 5 companies', 400);
    }

    const now = new Date().toISOString();
    const comparison: SavedComparison = {
      id: crypto.randomUUID(),
      userId,
      name: trimmedName,
      description: input.description?.trim() || null,
      symbols: input.symbols,
      metrics: input.metrics,
      period: input.period || 'annual',
      scope: input.scope || 'consolidated',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    return savedComparisonRepository.create(comparison);
  }

  async updateComparison(
    id: string,
    userId: string,
    input: {
      name?: string;
      description?: string | null;
      symbols?: ComparisonCompanyTarget[];
      metrics?: string[];
      period?: SupportedPeriod;
      scope?: 'consolidated' | 'standalone';
    },
  ): Promise<SavedComparison> {
    await this.getComparison(id, userId);

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName || trimmedName.length > 120) {
        throw new AppError('VALIDATION_ERROR', 'Comparison name must be between 1 and 120 characters', 400);
      }
      input.name = trimmedName;
    }

    if (input.symbols !== undefined) {
      if (input.symbols.length < 2 || input.symbols.length > 5) {
        throw new AppError('VALIDATION_ERROR', 'Comparisons must contain between 2 and 5 companies', 400);
      }
    }

    const updated = await savedComparisonRepository.update(id, userId, input);
    if (!updated) {
      throw new AppError('COMPARISON_NOT_FOUND', `Saved comparison ${id} not found`, 404);
    }

    return updated;
  }

  async duplicateComparison(id: string, userId: string): Promise<SavedComparison> {
    const original = await this.getComparison(id, userId);

    const now = new Date().toISOString();
    const duplicated: SavedComparison = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    return savedComparisonRepository.create(duplicated);
  }

  async deleteComparison(id: string, userId: string): Promise<void> {
    await this.getComparison(id, userId);
    await savedComparisonRepository.delete(id, userId);
  }
}

export const savedComparisonService = new SavedComparisonService();
