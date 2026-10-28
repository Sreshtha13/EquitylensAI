import { randomUUID } from 'node:crypto';
import type { SavedScreen, ScreenerStrategyDefinition } from '@equitylensai/shared';
import { savedScreenRepository } from '../repositories/savedScreenRepository.js';
import { screenerRunRepository } from '../repositories/screenerRunRepository.js';
import { executeScreenerQuery, type ScreenerExecutionResponse } from '../../ai/screener/screenerRepository.js';
import { screenerStrategyDefinitionSchema } from '../../ai/screener/screenerSchema.js';
import { AppError } from '../../utils/appError.js';
import type { CreateSavedScreenInput, UpdateSavedScreenInput } from '../types.js';

export class SavedScreenService {
  async listSavedScreens(userId: string): Promise<SavedScreen[]> {
    return savedScreenRepository.listByUser(userId);
  }

  async getSavedScreen(userId: string, id: string): Promise<SavedScreen> {
    const screen = await savedScreenRepository.getById(id, userId);
    if (!screen) {
      throw new AppError('SAVED_SCREEN_NOT_FOUND', 'Saved screen not found.', 404);
    }
    return screen;
  }

  async createSavedScreen(
    userId: string,
    input: CreateSavedScreenInput,
  ): Promise<SavedScreen> {
    const cleanName = input.name.trim();
    if (cleanName.length < 1 || cleanName.length > 120) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Saved screen name must be between 1 and 120 characters.',
        400,
      );
    }

    const validatedDefinition = screenerStrategyDefinitionSchema.parse(input.definition);

    const existing = await savedScreenRepository.listByUser(userId);
    const duplicate = existing.find(
      (s) => s.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (duplicate) {
      throw new AppError(
        'DUPLICATE_SAVED_SCREEN_NAME',
        `A saved screen named "${cleanName}" already exists.`,
        409,
      );
    }

    const now = new Date().toISOString();
    const screen: SavedScreen = {
      id: randomUUID(),
      userId,
      name: cleanName,
      description: input.description?.trim() || null,
      definition: validatedDefinition as ScreenerStrategyDefinition,
      lastRunAt: null,
      lastResultCount: null,
      createdAt: now,
      updatedAt: now,
    };

    return savedScreenRepository.create(screen);
  }

  async updateSavedScreen(
    userId: string,
    id: string,
    input: UpdateSavedScreenInput,
  ): Promise<SavedScreen> {
    const existing = await this.getSavedScreen(userId, id);

    const patch: Partial<SavedScreen> = {};

    if (input.name !== undefined) {
      const cleanName = input.name.trim();
      if (cleanName.length < 1 || cleanName.length > 120) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Saved screen name must be between 1 and 120 characters.',
          400,
        );
      }
      if (cleanName.toLowerCase() !== existing.name.toLowerCase()) {
        const userScreens = await savedScreenRepository.listByUser(userId);
        const duplicate = userScreens.find(
          (s) => s.id !== id && s.name.trim().toLowerCase() === cleanName.toLowerCase(),
        );
        if (duplicate) {
          throw new AppError(
            'DUPLICATE_SAVED_SCREEN_NAME',
            `A saved screen named "${cleanName}" already exists.`,
            409,
          );
        }
      }
      patch.name = cleanName;
    }

    if (input.description !== undefined) {
      patch.description = input.description ? input.description.trim() : null;
    }

    if (input.definition !== undefined) {
      const validated = screenerStrategyDefinitionSchema.parse(input.definition);
      patch.definition = validated as ScreenerStrategyDefinition;
    }

    patch.updatedAt = new Date().toISOString();

    const updated = await savedScreenRepository.update(id, userId, patch);
    if (!updated) {
      throw new AppError('SAVED_SCREEN_NOT_FOUND', 'Saved screen not found.', 404);
    }
    return updated;
  }

  async deleteSavedScreen(userId: string, id: string): Promise<void> {
    await this.getSavedScreen(userId, id);
    const deleted = await savedScreenRepository.delete(id, userId);
    if (!deleted) {
      throw new AppError('SAVED_SCREEN_NOT_FOUND', 'Saved screen not found.', 404);
    }
  }

  async duplicateSavedScreen(userId: string, id: string): Promise<SavedScreen> {
    const original = await this.getSavedScreen(userId, id);

    const userScreens = await savedScreenRepository.listByUser(userId);
    let newName = `${original.name} (Copy)`;
    let counter = 2;
    while (userScreens.some((s) => s.name.toLowerCase() === newName.toLowerCase())) {
      newName = `${original.name} (Copy ${counter})`;
      counter += 1;
    }

    const now = new Date().toISOString();
    const copy: SavedScreen = {
      id: randomUUID(),
      userId,
      name: newName,
      description: original.description,
      definition: JSON.parse(JSON.stringify(original.definition)),
      lastRunAt: null,
      lastResultCount: null,
      createdAt: now,
      updatedAt: now,
    };

    return savedScreenRepository.create(copy);
  }

  async runSavedScreen(
    userId: string,
    id: string,
    overrides?: { limit?: number; offset?: number },
  ): Promise<ScreenerExecutionResponse> {
    const screen = await this.getSavedScreen(userId, id);

    // Revalidate saved definition before executing
    const validatedDefinition = screenerStrategyDefinitionSchema.parse(screen.definition);

    const start = Date.now();
    const result = await executeScreenerQuery({
      query: `Saved screen: ${screen.name}`,
      exchange: validatedDefinition.exchange ?? undefined,
      assetType: 'equity',
      period: validatedDefinition.period,
      logic: validatedDefinition.rootGroup.logic,
      rootGroup: validatedDefinition.rootGroup,
      sort: validatedDefinition.sort,
      limit: overrides?.limit ?? 25,
      offset: overrides?.offset ?? 0,
    });
    const durationMs = Date.now() - start;

    const runTimestamp = new Date().toISOString();

    // Update lastRunAt and lastResultCount on the saved screen
    await savedScreenRepository.update(id, userId, {
      lastRunAt: runTimestamp,
      lastResultCount: result.totalMatches,
      updatedAt: runTimestamp,
    });

    // Record the run history with reproducibility audit snapshot
    await screenerRunRepository.recordRun({
      id: randomUUID(),
      userId,
      savedScreenId: id,
      definition: validatedDefinition as ScreenerStrategyDefinition,
      resultCount: result.totalMatches,
      durationMs,
      coverage: result.coverage,
      warnings: result.warnings,
      executedAt: runTimestamp,
      calculationVersion: '1.0.0',
      universeVersion: 'current',
      resultSnapshot: result.results.slice(0, 50).map((r) => ({
        symbol: r.symbol,
        exchange: r.exchange,
        period: r.period,
        metrics: r.metrics,
      })),
    });

    return result;
  }
}

export const savedScreenService = new SavedScreenService();
