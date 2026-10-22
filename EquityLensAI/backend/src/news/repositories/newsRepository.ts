import type { NewsItem, CorporateAnnouncement, GroundedAiSummary } from '@equitylensai/shared';
import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

class MemoryNewsStore {
  newsItems = new Map<string, NewsItem & { contentHash: string }>(); // keyed by id
  newsByHash = new Map<string, string>(); // contentHash -> id
  announcements = new Map<string, CorporateAnnouncement & { contentHash: string }>(); // keyed by id
  announcementsByHash = new Map<string, string>(); // contentHash -> id
  ingestionRuns: Array<{
    id: string;
    providerId: string;
    status: 'running' | 'success' | 'failed';
    itemsRetrieved: number;
    itemsInserted: number;
    duplicatesCount: number;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
  }> = [];

  clear(): void {
    this.newsItems.clear();
    this.newsByHash.clear();
    this.announcements.clear();
    this.announcementsByHash.clear();
    this.ingestionRuns = [];
  }
}

export const memoryNewsStore = new MemoryNewsStore();

async function supabaseRest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<{ data: T | null; status: number; ok: boolean }> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { data: null, status: 503, ok: false };
  }

  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${resource}`;
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { data: null, status: res.status, ok: false };
    }

    const text = await res.text();
    const data = text.trim().length > 0 ? (JSON.parse(text) as T) : null;
    return { data, status: res.status, ok: true };
  } catch (error) {
    logger.debug({ error, resource }, 'Supabase PostgREST request failed, using memory store');
    return { data: null, status: 500, ok: false };
  }
}

export const newsRepository = {
  async saveNewsItems(
    items: Array<NewsItem & { contentHash: string }>,
  ): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0;
    let duplicates = 0;

    for (const item of items) {
      // Deduplicate check
      if (memoryNewsStore.newsByHash.has(item.contentHash)) {
        duplicates++;
        // Update existing item with latest retrieval timestamp
        const existingId = memoryNewsStore.newsByHash.get(item.contentHash)!;
        const existing = memoryNewsStore.newsItems.get(existingId);
        if (existing) {
          existing.retrievedAt = item.retrievedAt;
        }
        continue;
      }

      memoryNewsStore.newsItems.set(item.id, item);
      memoryNewsStore.newsByHash.set(item.contentHash, item.id);
      inserted++;
    }

    // Attempt Supabase insert if configured
    const env = getEnv();
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && items.length > 0) {
      try {
        const rows = items.map((i) => ({
          id: i.id,
          provider_id: i.providerId,
          external_id: i.externalId,
          title: i.title,
          canonical_url: i.canonicalUrl,
          source_name: i.sourceName,
          source_type: i.sourceType,
          published_at: i.publishedAt,
          retrieved_at: i.retrievedAt,
          language: i.language,
          content_excerpt: i.contentExcerpt,
          content_hash: i.contentHash,
          category: i.category,
          ai_summary: i.aiSummary,
        }));

        await supabaseRest('news_items', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify(rows),
        });

        // Insert associations
        const assocRows: Record<string, unknown>[] = [];
        for (const item of items) {
          for (const s of item.symbols) {
            assocRows.push({
              news_item_id: item.id,
              symbol: s.symbol,
              exchange: s.exchange,
              confidence: s.confidence,
              association_method: s.method,
            });
          }
        }
        if (assocRows.length > 0) {
          await supabaseRest('company_news_associations', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates' },
            body: JSON.stringify(assocRows),
          });
        }
      } catch (err) {
        logger.debug({ err }, 'Supabase news save failed, preserved in memory');
      }
    }

    return { inserted, duplicates };
  },

  async saveAnnouncements(
    items: Array<CorporateAnnouncement & { contentHash: string }>,
  ): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0;
    let duplicates = 0;

    for (const item of items) {
      if (memoryNewsStore.announcementsByHash.has(item.contentHash)) {
        duplicates++;
        const existingId = memoryNewsStore.announcementsByHash.get(item.contentHash)!;
        const existing = memoryNewsStore.announcements.get(existingId);
        if (existing) {
          existing.retrievedAt = item.retrievedAt;
        }
        continue;
      }

      memoryNewsStore.announcements.set(item.id, item);
      memoryNewsStore.announcementsByHash.set(item.contentHash, item.id);
      inserted++;
    }

    const env = getEnv();
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && items.length > 0) {
      try {
        const rows = items.map((i) => ({
          id: i.id,
          provider_id: i.providerId,
          external_id: i.externalId,
          symbol: i.symbol,
          company_name: i.companyName,
          exchange: i.exchange,
          isin: i.isin,
          title: i.title,
          category: i.category,
          description: i.description,
          published_at: i.publishedAt,
          received_at: i.receivedAt,
          source_url: i.sourceUrl,
          document_url: i.documentUrl,
          file_size: i.fileSize,
          content_hash: i.contentHash,
          retrieved_at: i.retrievedAt,
          ai_summary: i.aiSummary,
        }));

        await supabaseRest('corporate_announcements', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify(rows),
        });
      } catch (err) {
        logger.debug({ err }, 'Supabase announcements save failed, preserved in memory');
      }
    }

    return { inserted, duplicates };
  },

  async getNews(
    options: {
      symbol?: string | undefined;
      exchange?: string | undefined;
      category?: string | undefined;
      sourceType?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
      limit?: number | undefined;
      page?: number | undefined;
    } = {},
  ): Promise<{ items: NewsItem[]; total: number }> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const page = Math.max(Number(options.page) || 1, 1);
    const offset = (page - 1) * limit;

    let all = Array.from(memoryNewsStore.newsItems.values());

    if (options.symbol) {
      const symUpper = options.symbol.toUpperCase();
      const exchUpper = options.exchange?.toUpperCase();
      all = all.filter((n) =>
        n.symbols.some((s) => s.symbol === symUpper && (!exchUpper || s.exchange === exchUpper)),
      );
    }

    if (options.category) {
      const catLower = options.category.toLowerCase();
      all = all.filter((n) => n.category?.toLowerCase() === catLower);
    }

    if (options.sourceType) {
      all = all.filter((n) => n.sourceType === options.sourceType);
    }

    if (options.from) {
      const fromTime = new Date(options.from).getTime();
      all = all.filter((n) => n.publishedAt && new Date(n.publishedAt).getTime() >= fromTime);
    }

    if (options.to) {
      const toTime = new Date(options.to).getTime();
      all = all.filter((n) => n.publishedAt && new Date(n.publishedAt).getTime() <= toTime);
    }

    // Sort by publication time descending
    all.sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    const total = all.length;
    const items = all.slice(offset, offset + limit);

    return { items, total };
  },

  async getAnnouncements(
    options: {
      symbol?: string | undefined;
      exchange?: string | undefined;
      category?: string | undefined;
      from?: string | undefined;
      to?: string | undefined;
      limit?: number | undefined;
      page?: number | undefined;
    } = {},
  ): Promise<{ items: CorporateAnnouncement[]; total: number }> {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const page = Math.max(Number(options.page) || 1, 1);
    const offset = (page - 1) * limit;

    let all = Array.from(memoryNewsStore.announcements.values());

    if (options.symbol) {
      const symUpper = options.symbol.toUpperCase();
      all = all.filter((a) => a.symbol === symUpper);
    }

    if (options.exchange) {
      const exchUpper = options.exchange.toUpperCase();
      all = all.filter((a) => a.exchange === exchUpper);
    }

    if (options.category) {
      all = all.filter((a) => a.category === options.category);
    }

    if (options.from) {
      const fromTime = new Date(options.from).getTime();
      all = all.filter((a) => new Date(a.publishedAt).getTime() >= fromTime);
    }

    if (options.to) {
      const toTime = new Date(options.to).getTime();
      all = all.filter((a) => new Date(a.publishedAt).getTime() <= toTime);
    }

    all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const total = all.length;
    const items = all.slice(offset, offset + limit);

    return { items, total };
  },

  async getAnnouncementById(id: string): Promise<CorporateAnnouncement | null> {
    const found = memoryNewsStore.announcements.get(id);
    return found ? { ...found } : null;
  },

  async getNewsById(id: string): Promise<NewsItem | null> {
    const found = memoryNewsStore.newsItems.get(id);
    return found ? { ...found } : null;
  },

  async updateNewsAiSummary(id: string, aiSummary: GroundedAiSummary): Promise<void> {
    const item = memoryNewsStore.newsItems.get(id);
    if (item) {
      item.aiSummary = aiSummary;
    }
  },

  async updateAnnouncementAiSummary(id: string, aiSummary: GroundedAiSummary): Promise<void> {
    const item = memoryNewsStore.announcements.get(id);
    if (item) {
      item.aiSummary = aiSummary;
    }
  },

  async recordIngestionRun(run: {
    providerId: string;
    status: 'running' | 'success' | 'failed';
    itemsRetrieved: number;
    itemsInserted: number;
    duplicatesCount: number;
    errorMessage?: string | null;
    completedAt?: string;
  }): Promise<void> {
    const record = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      providerId: run.providerId,
      status: run.status,
      itemsRetrieved: run.itemsRetrieved,
      itemsInserted: run.itemsInserted,
      duplicatesCount: run.duplicatesCount,
      errorMessage: run.errorMessage || null,
      startedAt: new Date().toISOString(),
      completedAt: run.completedAt || new Date().toISOString(),
    };
    memoryNewsStore.ingestionRuns.unshift(record);
    if (memoryNewsStore.ingestionRuns.length > 50) {
      memoryNewsStore.ingestionRuns.pop();
    }
  },

  async getIngestionRuns(): Promise<typeof memoryNewsStore.ingestionRuns> {
    return [...memoryNewsStore.ingestionRuns];
  },
};
