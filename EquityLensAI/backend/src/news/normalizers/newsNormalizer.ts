import type { NewsItem, CorporateAnnouncement } from '@equitylensai/shared';
import type { RawNewsItem, RawAnnouncementItem } from '../providers/types.js';
import { companyMatcher } from '../linking/companyMatcher.js';
import { deduplicator } from '../deduplication/deduplicator.js';

export class NewsNormalizer {
  private isValidHttpUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeNewsItem(
    raw: RawNewsItem,
    explicitSymbol?: string,
    explicitExchange?: string,
  ): (NewsItem & { contentHash: string }) | null {
    if (!raw.title || !raw.canonicalUrl || !this.isValidHttpUrl(raw.canonicalUrl)) {
      return null;
    }

    const title = this.sanitizeText(raw.title);
    if (title.length === 0) return null;

    const contentExcerpt = raw.contentExcerpt ? this.sanitizeText(raw.contentExcerpt) : null;
    const symbols = companyMatcher.matchNewsText(title, contentExcerpt);

    if (explicitSymbol) {
      const symUpper = explicitSymbol.toUpperCase();
      const exchUpper = (explicitExchange || 'NSE').toUpperCase();
      if (!symbols.some((s) => s.symbol === symUpper && s.exchange === exchUpper)) {
        symbols.unshift({
          symbol: symUpper,
          exchange: exchUpper,
          confidence: 0.99,
          method: 'symbol_exact',
        });
      }
    }

    const contentHash = deduplicator.computeNewsHash(raw);
    const id = `news_${contentHash.slice(0, 16)}`;

    return {
      id,
      providerId: raw.providerId,
      externalId: raw.externalId || null,
      title,
      canonicalUrl: raw.canonicalUrl,
      sourceName: this.sanitizeText(raw.sourceName),
      sourceType: raw.sourceType,
      publishedAt: raw.publishedAt,
      retrievedAt: raw.retrievedAt,
      language: raw.language || 'en',
      contentExcerpt,
      category: raw.category || 'General',
      symbols,
      contentHash,
    };
  }

  normalizeAnnouncement(
    raw: RawAnnouncementItem,
  ): (CorporateAnnouncement & { contentHash: string }) | null {
    if (!raw.title || !raw.sourceUrl || !this.isValidHttpUrl(raw.sourceUrl)) {
      return null;
    }

    const title = this.sanitizeText(raw.title);
    if (title.length === 0) return null;

    const matched = companyMatcher.matchAnnouncement(raw);
    const symbol = matched ? matched.symbol : raw.symbol.trim().toUpperCase();
    const companyName = matched?.companyName || this.sanitizeText(raw.companyName);
    const exchange = matched ? matched.exchange : (raw.exchange || 'NSE').toUpperCase();

    let documentUrl: string | null = null;
    if (raw.documentUrl && this.isValidHttpUrl(raw.documentUrl)) {
      documentUrl = raw.documentUrl;
    }

    const contentHash = deduplicator.computeAnnouncementHash(raw);
    const id = `ann_${contentHash.slice(0, 16)}`;

    return {
      id,
      providerId: raw.providerId,
      externalId: raw.externalId || null,
      symbol,
      companyName,
      exchange,
      isin: raw.isin || null,
      title,
      category: raw.category,
      description: raw.description ? this.sanitizeText(raw.description) : null,
      publishedAt: raw.publishedAt,
      receivedAt: raw.receivedAt || null,
      sourceUrl: raw.sourceUrl,
      documentUrl,
      fileSize: raw.fileSize || null,
      retrievedAt: raw.retrievedAt,
      contentHash,
    };
  }
}

export const newsNormalizer = new NewsNormalizer();
