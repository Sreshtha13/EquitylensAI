import type {
  AnnouncementsProvider,
  AnnouncementQueryOptions,
  RawAnnouncementItem,
} from './types.js';
import type { AnnouncementCategory, ProviderHealthInfo } from '@equitylensai/shared';
import { logger } from '../../utils/logger.js';

export class NseAnnouncementsProvider implements AnnouncementsProvider {
  readonly id = 'nse_official';
  readonly name = 'NSE Corporate Disclosures';

  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;

  isConfigured(): boolean {
    return true; // Public official exchange endpoint
  }

  async getHealth(): Promise<ProviderHealthInfo> {
    return {
      id: this.id,
      name: this.name,
      status: this.lastError && !this.lastSuccessAt ? 'degraded' : 'operational',
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      coverage: 'Indian equities listed on NSE (Official Exchange Filings)',
    };
  }

  mapNseCategory(text: string): AnnouncementCategory {
    const lower = text.toLowerCase();
    if (
      lower.includes('financial result') ||
      lower.includes('quarterly') ||
      lower.includes('audited')
    ) {
      return 'financial_results';
    }
    if (lower.includes('board meeting')) {
      return 'board_meetings';
    }
    if (lower.includes('dividend')) {
      return 'dividend';
    }
    if (lower.includes('bonus')) {
      return 'bonus_issue';
    }
    if (lower.includes('split') || lower.includes('sub-division')) {
      return 'stock_split';
    }
    if (lower.includes('rights')) {
      return 'rights_issue';
    }
    if (
      lower.includes('fund raise') ||
      lower.includes('qip') ||
      lower.includes('allotment of securities')
    ) {
      return 'fundraising';
    }
    if (
      lower.includes('merger') ||
      lower.includes('acquisition') ||
      lower.includes('amalgamation') ||
      lower.includes('takeover')
    ) {
      return 'mergers_acquisitions';
    }
    if (lower.includes('shareholding') || lower.includes('reg 31') || lower.includes('reg. 31')) {
      return 'shareholding_pattern';
    }
    if (
      lower.includes('resignation') ||
      lower.includes('appointment') ||
      lower.includes('director') ||
      lower.includes('kmp') ||
      lower.includes('key managerial')
    ) {
      return 'management_changes';
    }
    if (
      lower.includes('rating') ||
      lower.includes('crisil') ||
      lower.includes('icra') ||
      lower.includes('care')
    ) {
      return 'credit_rating';
    }
    if (lower.includes('governance')) {
      return 'governance';
    }
    if (
      lower.includes('sebi') ||
      lower.includes('regulation') ||
      lower.includes('compliance') ||
      lower.includes('certificate under')
    ) {
      return 'regulatory';
    }
    return 'updates';
  }

  parseNseDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    // formats: "2026-10-22 19:46:21" or "22-Oct-2026 19:46:21"
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    const match = dateStr.match(
      /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/,
    );
    if (match && match[1] && match[2] && match[3]) {
      const months: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const month = months[monthStr] ?? 0;
      const year = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const min = match[5] ? parseInt(match[5], 10) : 0;
      const sec = match[6] ? parseInt(match[6], 10) : 0;
      // IST is UTC+5:30
      const utcMs = Date.UTC(year, month, day, hour - 5, min - 30, sec);
      return new Date(utcMs).toISOString();
    }
    return new Date().toISOString();
  }

  async fetchAnnouncements(options: AnnouncementQueryOptions = {}): Promise<RawAnnouncementItem[]> {
    let url = 'https://www.nseindia.com/api/corporate-announcements?index=equities';
    if (options.symbol) {
      const cleanSym = encodeURIComponent(options.symbol.trim().toUpperCase());
      url += `&symbol=${cleanSym}`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`NSE API returned status ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        logger.warn({ data }, 'NSE announcements response was not an array');
        return [];
      }

      const results: RawAnnouncementItem[] = [];
      const retrievedAt = new Date().toISOString();
      const limit = options.limit && options.limit > 0 ? options.limit : 50;

      for (const item of data) {
        if (!item || !item.symbol) continue;

        const symbol = String(item.symbol).trim().toUpperCase();
        const companyName = String(item.sm_name || symbol).trim();
        const desc = item.desc ? String(item.desc).trim() : '';
        const attchmntText = item.attchmntText ? String(item.attchmntText).trim() : '';
        const title = desc || attchmntText || 'Exchange Disclosure';
        const description = attchmntText && attchmntText !== title ? attchmntText : desc || null;
        const category = this.mapNseCategory(`${title} ${description || ''}`);

        if (options.category && category !== options.category) {
          continue;
        }

        const publishedAt = this.parseNseDate(item.sort_date || item.an_dt || '');
        const receivedAt = item.exchdisstime ? this.parseNseDate(item.exchdisstime) : null;

        let documentUrl: string | null = null;
        if (item.attchmntFile && typeof item.attchmntFile === 'string') {
          const file = item.attchmntFile.trim();
          if (file.startsWith('http://') || file.startsWith('https://')) {
            documentUrl = file;
          } else {
            documentUrl = `https://nsearchives.nseindia.com/corporate/${file}`;
          }
        }

        results.push({
          providerId: this.id,
          externalId: item.seq_id ? String(item.seq_id) : item.dt ? String(item.dt) : null,
          symbol,
          companyName,
          exchange: 'NSE',
          isin: item.sm_isin ? String(item.sm_isin).trim() : null,
          title,
          category,
          description,
          publishedAt,
          receivedAt,
          sourceUrl: 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
          documentUrl,
          fileSize:
            item.fileSize || item.attFileSize ? String(item.fileSize || item.attFileSize) : null,
          retrievedAt,
        });

        if (results.length >= limit) {
          break;
        }
      }

      this.lastSuccessAt = retrievedAt;
      this.lastError = null;
      return results;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.lastError = message;
      logger.error({ err, options }, 'Failed to fetch announcements from NSE');
      return [];
    }
  }
}
