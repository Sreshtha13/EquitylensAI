import crypto from 'node:crypto';
import type { RawNewsItem, RawAnnouncementItem } from '../providers/types.js';

export class Deduplicator {
  computeNewsHash(item: RawNewsItem): string {
    // Prefer externalId from provider if available, otherwise canonicalUrl
    const identifier = item.externalId
      ? `${item.providerId}:id:${item.externalId}`
      : `${item.providerId}:url:${this.sanitizeUrl(item.canonicalUrl)}`;

    return crypto.createHash('sha256').update(identifier).digest('hex');
  }

  computeAnnouncementHash(item: RawAnnouncementItem): string {
    const identifier = item.externalId
      ? `${item.providerId}:${item.exchange}:${item.symbol}:id:${item.externalId}`
      : `${item.providerId}:${item.exchange}:${item.symbol}:${item.title}:${item.publishedAt}`;

    return crypto.createHash('sha256').update(identifier).digest('hex');
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove ephemeral tracking parameters (utm_*, oc, etc.)
      const keysToRemove: string[] = [];
      parsed.searchParams.forEach((_val, key) => {
        if (key.startsWith('utm_') || key === 'oc' || key === 'ved' || key === 'usg') {
          keysToRemove.push(key);
        }
      });
      for (const k of keysToRemove) {
        parsed.searchParams.delete(k);
      }
      return parsed.toString();
    } catch {
      return url.trim();
    }
  }
}

export const deduplicator = new Deduplicator();
