import type { NewsProvider, NewsQueryOptions, RawNewsItem } from './types.js';
import type { ProviderHealthInfo } from '@equitylensai/shared';
import { logger } from '../../utils/logger.js';

export class GoogleNewsProvider implements NewsProvider {
  readonly id = 'google_news_rss';
  readonly name = 'Verified Financial News (Google News RSS)';

  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;

  isConfigured(): boolean {
    return true; // Public RSS feed
  }

  async getHealth(): Promise<ProviderHealthInfo> {
    return {
      id: this.id,
      name: this.name,
      status: this.lastError && !this.lastSuccessAt ? 'degraded' : 'operational',
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      coverage:
        'Comprehensive Indian financial press (Livemint, Economic Times, Business Standard, Reuters)',
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseXmlItems(xml: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    const retrievedAt = new Date().toISOString();

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      if (!itemContent) continue;

      // Extract title
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      let rawTitle = titleMatch && titleMatch[1] ? this.stripHtml(titleMatch[1]) : '';

      // Extract link
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const canonicalUrl = linkMatch && linkMatch[1] ? linkMatch[1].trim() : '';

      // Extract guid
      const guidMatch = itemContent.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
      const externalId = guidMatch && guidMatch[1] ? guidMatch[1].trim() : null;

      // Extract pubDate
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      let publishedAt: string | null = null;
      if (pubDateMatch && pubDateMatch[1]) {
        const d = new Date(pubDateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          publishedAt = d.toISOString();
        }
      }

      // Extract source
      const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      let sourceName =
        sourceMatch && sourceMatch[1] ? this.stripHtml(sourceMatch[1]) : 'Financial News';

      // If title ends with " - Source Name", separate it
      if (rawTitle.includes(' - ')) {
        const lastDash = rawTitle.lastIndexOf(' - ');
        const trailingSource = rawTitle.slice(lastDash + 3).trim();
        if (trailingSource.length > 0 && trailingSource.length <= 40) {
          if (sourceName === 'Financial News') {
            sourceName = trailingSource;
          }
          rawTitle = rawTitle.slice(0, lastDash).trim();
        }
      }

      // Extract description snippet
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
      const contentExcerpt = descMatch && descMatch[1] ? this.stripHtml(descMatch[1]) : null;

      if (rawTitle && canonicalUrl) {
        items.push({
          providerId: this.id,
          externalId,
          title: rawTitle,
          canonicalUrl,
          sourceName,
          sourceType: 'news_publisher',
          publishedAt,
          retrievedAt,
          language: 'en',
          contentExcerpt:
            contentExcerpt && contentExcerpt !== rawTitle ? contentExcerpt.slice(0, 500) : null,
          category: 'Market News',
        });
      }
    }

    return items;
  }

  async fetchNews(options: NewsQueryOptions = {}): Promise<RawNewsItem[]> {
    let query = options.query?.trim();

    if (!query) {
      if (options.symbol) {
        query = `${options.symbol} ${options.exchange || 'NSE'} stock news`;
      } else if (options.category) {
        query = `${options.category} Indian stock market`;
      } else {
        query = 'Indian Stock Market NSE NIFTY BSE';
      }
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`Google News RSS returned status ${response.status}`);
      }

      const xml = await response.text();
      const rawItems = this.parseXmlItems(xml);

      const limit = options.limit && options.limit > 0 ? options.limit : 30;
      const results = rawItems.slice(0, limit);

      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      return results;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      logger.error({ err, options }, 'Failed to fetch news from Google News RSS');
      return [];
    }
  }
}
