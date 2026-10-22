import { providerRegistry } from '../providers/registry.js';
import { newsNormalizer } from '../normalizers/newsNormalizer.js';
import { newsRepository } from '../repositories/newsRepository.js';
import { logger } from '../../utils/logger.js';
import type { NewsIngestionStatus } from '@equitylensai/shared';

class IngestionManager {
  private isIngesting = false;
  private lastRunAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastRetrievedCount = 0;
  private lastInsertedCount = 0;
  private lastDuplicatesCount = 0;

  async runIngestion(): Promise<{
    success: boolean;
    newsRetrieved: number;
    newsInserted: number;
    announcementsRetrieved: number;
    announcementsInserted: number;
    duplicates: number;
  }> {
    if (this.isIngesting) {
      logger.warn('Ingestion job already running, skipping concurrent trigger');
      return {
        success: false,
        newsRetrieved: 0,
        newsInserted: 0,
        announcementsRetrieved: 0,
        announcementsInserted: 0,
        duplicates: 0,
      };
    }

    this.isIngesting = true;
    this.lastRunAt = new Date().toISOString();
    let totalRetrieved = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;

    let newsRetrieved = 0;
    let newsInserted = 0;
    let announcementsRetrieved = 0;
    let announcementsInserted = 0;

    try {
      // 1. Ingest News Providers
      const newsProviders = providerRegistry.getAllNewsProviders();
      for (const provider of newsProviders) {
        if (!provider.isConfigured()) continue;

        try {
          const rawItems = await provider.fetchNews({ limit: 40 });
          newsRetrieved += rawItems.length;

          const normalizedItems = rawItems
            .map((r) => newsNormalizer.normalizeNewsItem(r))
            .filter((i): i is NonNullable<typeof i> => i !== null);

          const { inserted, duplicates } = await newsRepository.saveNewsItems(normalizedItems);
          newsInserted += inserted;
          totalDuplicates += duplicates;

          await newsRepository.recordIngestionRun({
            providerId: provider.id,
            status: 'success',
            itemsRetrieved: rawItems.length,
            itemsInserted: inserted,
            duplicatesCount: duplicates,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err, providerId: provider.id }, 'Ingestion failed for news provider');
          await newsRepository.recordIngestionRun({
            providerId: provider.id,
            status: 'failed',
            itemsRetrieved: 0,
            itemsInserted: 0,
            duplicatesCount: 0,
            errorMessage: message,
          });
        }
      }

      // 2. Ingest Announcements Providers
      const annProviders = providerRegistry.getAllAnnouncementsProviders();
      for (const provider of annProviders) {
        if (!provider.isConfigured()) continue;

        try {
          const rawItems = await provider.fetchAnnouncements({ limit: 40 });
          announcementsRetrieved += rawItems.length;

          const normalizedItems = rawItems
            .map((r) => newsNormalizer.normalizeAnnouncement(r))
            .filter((i): i is NonNullable<typeof i> => i !== null);

          const { inserted, duplicates } = await newsRepository.saveAnnouncements(normalizedItems);
          announcementsInserted += inserted;
          totalDuplicates += duplicates;

          await newsRepository.recordIngestionRun({
            providerId: provider.id,
            status: 'success',
            itemsRetrieved: rawItems.length,
            itemsInserted: inserted,
            duplicatesCount: duplicates,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(
            { err, providerId: provider.id },
            'Ingestion failed for announcement provider',
          );
          await newsRepository.recordIngestionRun({
            providerId: provider.id,
            status: 'failed',
            itemsRetrieved: 0,
            itemsInserted: 0,
            duplicatesCount: 0,
            errorMessage: message,
          });
        }
      }

      totalRetrieved = newsRetrieved + announcementsRetrieved;
      totalInserted = newsInserted + announcementsInserted;

      this.lastRetrievedCount = totalRetrieved;
      this.lastInsertedCount = totalInserted;
      this.lastDuplicatesCount = totalDuplicates;
      this.lastSuccessAt = new Date().toISOString();

      return {
        success: true,
        newsRetrieved,
        newsInserted,
        announcementsRetrieved,
        announcementsInserted,
        duplicates: totalDuplicates,
      };
    } finally {
      this.isIngesting = false;
    }
  }

  async getStatus(): Promise<NewsIngestionStatus> {
    const providers = await providerRegistry.getAllProvidersHealth();
    return {
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      status: this.isIngesting ? 'running' : this.lastSuccessAt ? 'success' : 'idle',
      itemsRetrieved: this.lastRetrievedCount,
      itemsInserted: this.lastInsertedCount,
      duplicatesCount: this.lastDuplicatesCount,
      providers,
    };
  }
}

export const ingestionManager = new IngestionManager();
