import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { newsRepository, memoryNewsStore } from '../src/news/repositories/newsRepository.js';
import { newsNormalizer } from '../src/news/normalizers/newsNormalizer.js';
import { companyMatcher } from '../src/news/linking/companyMatcher.js';
import { deduplicator } from '../src/news/deduplication/deduplicator.js';
import { providerRegistry } from '../src/news/providers/registry.js';
import { NseAnnouncementsProvider } from '../src/news/providers/nseAnnouncementsProvider.js';
import { GoogleNewsProvider } from '../src/news/providers/googleNewsProvider.js';
import { memoryStore } from '../src/db/userRepository.js';
import type { RawNewsItem, RawAnnouncementItem } from '../src/news/providers/types.js';

describe('Phase 8: Market News, Corporate Announcements & Event Intelligence', () => {
  const app = createApp();

  beforeEach(() => {
    memoryNewsStore.clear();
    memoryStore.clear();
    vi.restoreAllMocks();
  });

  describe('Deduplication & Content Hashing', () => {
    it('computes deterministic content hashes for news items', () => {
      const item1: RawNewsItem = {
        providerId: 'google_news_rss',
        externalId: 'guid123',
        title: 'Reliance Q2 Profit Jumps 10%',
        canonicalUrl: 'https://news.example.com/reliance-q2?utm_source=twitter&oc=5',
        sourceName: 'Financial Express',
        sourceType: 'news_publisher',
        publishedAt: '2026-10-22T08:00:00.000Z',
        retrievedAt: '2026-10-22T08:05:00.000Z',
      };

      const item2: RawNewsItem = {
        ...item1,
        canonicalUrl: 'https://news.example.com/reliance-q2?utm_campaign=daily',
      };

      const hash1 = deduplicator.computeNewsHash(item1);
      const hash2 = deduplicator.computeNewsHash(item2);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64);
    });

    it('computes deterministic content hashes for corporate announcements', () => {
      const ann1: RawAnnouncementItem = {
        providerId: 'nse_official',
        externalId: 'seq999',
        symbol: 'TCS',
        companyName: 'Tata Consultancy Services Limited',
        exchange: 'NSE',
        title: 'Board Meeting to consider Dividend',
        category: 'board_meetings',
        description: 'Board meeting scheduled for November 1',
        publishedAt: '2026-10-22T10:00:00.000Z',
        sourceUrl: 'https://www.nseindia.com/announcements',
        retrievedAt: '2026-10-22T10:05:00.000Z',
      };

      const ann2: RawAnnouncementItem = { ...ann1 };

      const hash1 = deduplicator.computeAnnouncementHash(ann1);
      const hash2 = deduplicator.computeAnnouncementHash(ann2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Company Matcher & Identification', () => {
    it('matches corporate announcement by ISIN accurately', () => {
      const ann: RawAnnouncementItem = {
        providerId: 'nse_official',
        symbol: 'UNKNOWN',
        companyName: 'Reliance Industries Limited',
        exchange: 'NSE',
        isin: 'INE002A01018',
        title: 'Shareholder Meeting Outcome',
        category: 'general',
        description: null,
        publishedAt: '2026-10-22T10:00:00.000Z',
        sourceUrl: 'https://www.nseindia.com',
        retrievedAt: '2026-10-22T10:00:00.000Z',
      };

      const matched = companyMatcher.matchAnnouncement(ann);
      expect(matched).not.toBeNull();
      expect(matched?.symbol).toBe('RELIANCE');
      expect(matched?.exchange).toBe('NSE');
      expect(matched?.method).toBe('isin');
      expect(matched?.confidence).toBe(1.0);
    });

    it('matches corporate announcement by symbol and exchange', () => {
      const ann: RawAnnouncementItem = {
        providerId: 'nse_official',
        symbol: 'INFY',
        companyName: 'Infosys Limited',
        exchange: 'NSE',
        title: 'Financial Results for Q2',
        category: 'financial_results',
        description: null,
        publishedAt: '2026-10-22T10:00:00.000Z',
        sourceUrl: 'https://www.nseindia.com',
        retrievedAt: '2026-10-22T10:00:00.000Z',
      };

      const matched = companyMatcher.matchAnnouncement(ann);
      expect(matched).not.toBeNull();
      expect(matched?.symbol).toBe('INFY');
      expect(matched?.method).toBe('symbol_exchange');
      expect(matched?.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('matches companies from news text without false positive on generic words', () => {
      const title = 'TCS and Infosys report strong cloud revenue growth in Q2';
      const excerpt = 'Tata Consultancy Services and INFY saw substantial margin improvement.';

      const matches = companyMatcher.matchNewsText(title, excerpt);
      const matchedSymbols = matches.map((m) => m.symbol);

      expect(matchedSymbols).toContain('TCS');
      expect(matchedSymbols).toContain('INFY');
      // Should not false match common words like IT, ON, BE
      expect(matchedSymbols).not.toContain('IT');
    });
  });

  describe('News & Announcement Normalization & Sanitization', () => {
    it('normalizes news items and rejects unsafe javascript: URLs', () => {
      const rawUnsafe: RawNewsItem = {
        providerId: 'test_provider',
        title: 'Suspicious Article',
        canonicalUrl: 'javascript:alert(1)',
        sourceName: 'Unknown',
        sourceType: 'news_publisher',
        publishedAt: '2026-10-22T10:00:00.000Z',
        retrievedAt: '2026-10-22T10:00:00.000Z',
      };

      const normalized = newsNormalizer.normalizeNewsItem(rawUnsafe);
      expect(normalized).toBeNull();
    });

    it('sanitizes script tags in titles and excerpts', () => {
      const raw: RawNewsItem = {
        providerId: 'google_news_rss',
        title: 'Market Rally <script>alert("xss")</script> Continues',
        canonicalUrl: 'https://example.com/market-rally',
        sourceName: 'Mint',
        sourceType: 'news_publisher',
        publishedAt: '2026-10-22T10:00:00.000Z',
        retrievedAt: '2026-10-22T10:00:00.000Z',
        contentExcerpt: 'Sensex rose 400 points <style>body{color:red}</style> on foreign inflows.',
      };

      const normalized = newsNormalizer.normalizeNewsItem(raw);
      expect(normalized).not.toBeNull();
      expect(normalized?.title).toBe('Market Rally Continues');
      expect(normalized?.contentExcerpt).toBe('Sensex rose 400 points on foreign inflows.');
    });
  });

  describe('Provider Implementations & Health Checks', () => {
    it('reports health status across all registered providers', async () => {
      const healthList = await providerRegistry.getAllProvidersHealth();
      expect(Array.isArray(healthList)).toBe(true);
      expect(healthList.length).toBeGreaterThanOrEqual(3);

      const nseHealth = healthList.find((h) => h.id === 'nse_official');
      expect(nseHealth).toBeDefined();
      expect(nseHealth?.name).toContain('NSE');

      const googleHealth = healthList.find((h) => h.id === 'google_news_rss');
      expect(googleHealth).toBeDefined();
    });

    it('NseAnnouncementsProvider maps categories correctly', () => {
      const provider = new NseAnnouncementsProvider();
      expect(provider.mapNseCategory('Financial Results for the quarter ended Sept 2026')).toBe(
        'financial_results',
      );
      expect(provider.mapNseCategory('Notice of Board Meeting to consider interim dividend')).toBe(
        'board_meetings',
      );
      expect(provider.mapNseCategory('Declaration of Interim Dividend 2026-27')).toBe('dividend');
      expect(provider.mapNseCategory('Certificate under Regulation 74(5) of SEBI')).toBe(
        'regulatory',
      );
      expect(provider.mapNseCategory('Resignation of Independent Director')).toBe(
        'management_changes',
      );
      expect(provider.mapNseCategory('General corporate update regarding plant expansion')).toBe(
        'updates',
      );
    });

    it('NseAnnouncementsProvider handles network errors gracefully without throwing', async () => {
      const provider = new NseAnnouncementsProvider();
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection timeout'));

      const results = await provider.fetchAnnouncements({ symbol: 'RELIANCE' });
      expect(results).toEqual([]);
      const health = await provider.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.lastError).toContain('Connection timeout');
    });

    it('GoogleNewsProvider handles network failure gracefully', async () => {
      const provider = new GoogleNewsProvider();
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('DNS resolution failed'));

      const results = await provider.fetchNews({ query: 'Nifty' });
      expect(results).toEqual([]);
      const health = await provider.getHealth();
      expect(health.status).toBe('degraded');
    });
  });

  describe('News Repository & Ingestion Idempotency', () => {
    it('saves news items and ignores duplicates idempotently', async () => {
      const raw: RawNewsItem = {
        providerId: 'google_news_rss',
        externalId: 'ext_1',
        title: 'HDFC Bank records robust deposit growth',
        canonicalUrl: 'https://news.example.com/hdfc-deposits',
        sourceName: 'Business Standard',
        sourceType: 'news_publisher',
        publishedAt: '2026-10-22T09:00:00.000Z',
        retrievedAt: '2026-10-22T09:05:00.000Z',
      };

      const normalized = newsNormalizer.normalizeNewsItem(raw, 'HDFCBANK', 'NSE')!;
      expect(normalized).toBeDefined();

      const run1 = await newsRepository.saveNewsItems([normalized]);
      expect(run1.inserted).toBe(1);
      expect(run1.duplicates).toBe(0);

      // Save again
      const run2 = await newsRepository.saveNewsItems([normalized]);
      expect(run2.inserted).toBe(0);
      expect(run2.duplicates).toBe(1);

      const { total } = await newsRepository.getNews({ symbol: 'HDFCBANK' });
      expect(total).toBe(1);
    });

    it('saves corporate announcements and supports filtering by category and symbol', async () => {
      const ann1: RawAnnouncementItem = {
        providerId: 'nse_official',
        externalId: 'ann_1',
        symbol: 'TCS',
        companyName: 'Tata Consultancy Services',
        exchange: 'NSE',
        title: 'Financial Results Q2',
        category: 'financial_results',
        description: 'Audited Standalone and Consolidated Results',
        publishedAt: '2026-10-22T11:00:00.000Z',
        sourceUrl: 'https://www.nseindia.com',
        retrievedAt: '2026-10-22T11:01:00.000Z',
      };

      const ann2: RawAnnouncementItem = {
        providerId: 'nse_official',
        externalId: 'ann_2',
        symbol: 'TCS',
        companyName: 'Tata Consultancy Services',
        exchange: 'NSE',
        title: 'Intimation of Board Meeting',
        category: 'board_meetings',
        description: null,
        publishedAt: '2026-10-22T10:00:00.000Z',
        sourceUrl: 'https://www.nseindia.com',
        retrievedAt: '2026-10-22T10:01:00.000Z',
      };

      const norm1 = newsNormalizer.normalizeAnnouncement(ann1)!;
      const norm2 = newsNormalizer.normalizeAnnouncement(ann2)!;

      await newsRepository.saveAnnouncements([norm1, norm2]);

      const resultsAll = await newsRepository.getAnnouncements({ symbol: 'TCS' });
      expect(resultsAll.total).toBe(2);

      const resultsFiltered = await newsRepository.getAnnouncements({
        symbol: 'TCS',
        category: 'financial_results',
      });
      expect(resultsFiltered.total).toBe(1);
      expect(resultsFiltered.items[0]?.category).toBe('financial_results');
    });
  });

  describe('Backend API Endpoints', () => {
    beforeEach(async () => {
      // Seed test items
      const rawNews: RawNewsItem = {
        providerId: 'google_news_rss',
        externalId: 'news_test_1',
        title: 'Reliance Industries unveils massive renewable energy expansion',
        canonicalUrl: 'https://livemint.com/market/reliance-renewable-2026',
        sourceName: 'Livemint',
        sourceType: 'news_publisher',
        publishedAt: '2026-10-22T12:00:00.000Z',
        retrievedAt: '2026-10-22T12:05:00.000Z',
        contentExcerpt: 'Chairman announced multi-billion green hydrogen investments.',
      };
      const normNews = newsNormalizer.normalizeNewsItem(rawNews, 'RELIANCE', 'NSE')!;
      await newsRepository.saveNewsItems([normNews]);

      const rawAnn: RawAnnouncementItem = {
        providerId: 'nse_official',
        externalId: 'ann_test_1',
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Limited',
        exchange: 'NSE',
        isin: 'INE002A01018',
        title: 'Outcome of Board Meeting - Dividend Recommendation',
        category: 'dividend',
        description: 'Recommended dividend of Rs 10 per equity share.',
        publishedAt: '2026-10-22T12:30:00.000Z',
        sourceUrl: 'https://www.nseindia.com/filings',
        documentUrl: 'https://nsearchives.nseindia.com/corporate/reliance_div.pdf',
        fileSize: '240 KB',
        retrievedAt: '2026-10-22T12:35:00.000Z',
      };
      const normAnn = newsNormalizer.normalizeAnnouncement(rawAnn)!;
      await newsRepository.saveAnnouncements([normAnn]);
    });

    it('GET /api/v1/news returns market news with provenance and pagination', async () => {
      const res = await request(app).get('/api/v1/news');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.freshness).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const first = res.body.data.items[0];
      expect(first.canonicalUrl).toMatch(/^https?:\/\//);
      expect(first.sourceName).toBe('Livemint');
    });

    it('GET /api/v1/stocks/:symbol/news returns company-specific news', async () => {
      const res = await request(app).get('/api/v1/stocks/RELIANCE/news?exchange=NSE');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].title).toContain('Reliance');
    });

    it('GET /api/v1/announcements returns corporate disclosures feed', async () => {
      const res = await request(app).get('/api/v1/announcements');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const first = res.body.data.items[0];
      expect(first.exchange).toBe('NSE');
      expect(first.symbol).toBe('RELIANCE');
      expect(first.category).toBe('dividend');
      expect(first.documentUrl).toContain('.pdf');
    });

    it('GET /api/v1/stocks/:symbol/announcements returns company filings', async () => {
      const res = await request(app).get('/api/v1/stocks/RELIANCE/announcements?exchange=NSE');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].symbol).toBe('RELIANCE');
    });

    it('GET /api/v1/announcements/:announcementId returns announcement detail', async () => {
      const listRes = await request(app).get('/api/v1/announcements');
      const id = listRes.body.data.items[0].id;

      const detailRes = await request(app).get(`/api/v1/announcements/${id}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.success).toBe(true);
      expect(detailRes.body.data.id).toBe(id);
      expect(detailRes.body.data.title).toContain('Dividend');
    });

    it('GET /api/v1/news/status returns provider operational telemetry', async () => {
      const res = await request(app).get('/api/v1/news/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providers).toBeDefined();
      expect(Array.isArray(res.body.data.providers)).toBe(true);
    });

    it('POST /api/v1/news/ingest runs ingestion job', async () => {
      const res = await request(app).post('/api/v1/news/ingest');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(true);
    });
  });

  describe('Watchlist Intelligence & Authorization Security', () => {
    it('rejects unauthenticated requests to /api/v1/users/me/watchlist-news with 401', async () => {
      const res = await request(app).get('/api/v1/users/me/watchlist-news');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns deduplicated news for authenticated user watchlists', async () => {
      const userId = 'test-user-phase8';
      const userHeaders = {
        'x-test-user-id': userId,
        'x-test-user-email': 'investor_phase8@equitylens.ai',
      };

      // 1. Add a watchlist with RELIANCE
      const wlRes = await request(app)
        .post('/api/v1/watchlists')
        .set(userHeaders)
        .send({ name: 'Energy Watchlist' });
      expect(wlRes.status).toBe(201);
      const wlId = wlRes.body.data.id;

      await request(app)
        .post(`/api/v1/watchlists/${wlId}/items`)
        .set(userHeaders)
        .send({ symbol: 'RELIANCE', exchange: 'NSE' });

      // Seed news item for RELIANCE
      const rawNews: RawNewsItem = {
        providerId: 'google_news_rss',
        externalId: 'ext_wl_1',
        title: 'Reliance Retail Expands Footprint',
        canonicalUrl: 'https://news.example.com/reliance-retail',
        sourceName: 'Economic Times',
        sourceType: 'news_publisher',
        publishedAt: '2026-10-22T14:00:00.000Z',
        retrievedAt: '2026-10-22T14:05:00.000Z',
      };
      const normNews = newsNormalizer.normalizeNewsItem(rawNews, 'RELIANCE', 'NSE')!;
      await newsRepository.saveNewsItems([normNews]);

      // 2. Query watchlist news
      const wlNewsRes = await request(app).get('/api/v1/users/me/watchlist-news').set(userHeaders);

      expect(wlNewsRes.status).toBe(200);
      expect(wlNewsRes.body.success).toBe(true);
      expect(wlNewsRes.body.data.symbolsWatched).toContain('RELIANCE');
      expect(wlNewsRes.body.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });
});
