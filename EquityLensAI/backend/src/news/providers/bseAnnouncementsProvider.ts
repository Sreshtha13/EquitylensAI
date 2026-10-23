import type {
  AnnouncementsProvider,
  AnnouncementQueryOptions,
  RawAnnouncementItem,
} from './types.js';
import type { AnnouncementCategory, ProviderHealthInfo } from '@equitylensai/shared';
import { logger } from '../../utils/logger.js';

export class BseAnnouncementsProvider implements AnnouncementsProvider {
  readonly id = 'bse_official';
  readonly name = 'BSE Corporate Disclosures';

  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;

  isConfigured(): boolean {
    return true; // Public official exchange endpoint
  }

  async getHealth(): Promise<ProviderHealthInfo> {
    return {
      id: this.id,
      name: this.name,
      status: this.lastError ? 'degraded' : 'operational',
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      coverage: 'Indian equities listed on BSE',
    };
  }

  private mapBseCategory(text: string): AnnouncementCategory {
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
    if (lower.includes('split')) {
      return 'stock_split';
    }
    if (lower.includes('rights')) {
      return 'rights_issue';
    }
    if (lower.includes('fund') || lower.includes('allotment')) {
      return 'fundraising';
    }
    if (lower.includes('merger') || lower.includes('acquisition') || lower.includes('takeover')) {
      return 'mergers_acquisitions';
    }
    if (lower.includes('shareholding')) {
      return 'shareholding_pattern';
    }
    if (
      lower.includes('resignation') ||
      lower.includes('appointment') ||
      lower.includes('director')
    ) {
      return 'management_changes';
    }
    if (lower.includes('rating')) {
      return 'credit_rating';
    }
    if (lower.includes('governance')) {
      return 'governance';
    }
    if (lower.includes('regulatory') || lower.includes('sebi') || lower.includes('compliance')) {
      return 'regulatory';
    }
    return 'updates';
  }

  async fetchAnnouncements(options: AnnouncementQueryOptions = {}): Promise<RawAnnouncementItem[]> {
    const today = new Date();
    const prev = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const strPrevDate = formatDate(prev);
    const strToDate = formatDate(today);
    const scrip = options.symbol?.trim() || '';

    const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${strPrevDate}&strScrip=${encodeURIComponent(scrip)}&strSearch=P&strToDate=${strToDate}&strType=C`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://www.bseindia.com/',
          Origin: 'https://www.bseindia.com',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`BSE API returned status ${response.status}`);
      }

      const json = (await response.json()) as { Table?: Record<string, unknown>[] } | null;
      if (!json || !Array.isArray(json.Table)) {
        this.lastSuccessAt = new Date().toISOString();
        return [];
      }

      const results: RawAnnouncementItem[] = [];
      const retrievedAt = new Date().toISOString();
      const limit = options.limit && options.limit > 0 ? options.limit : 30;

      for (const item of json.Table) {
        if (!item) continue;
        const symbol = String(item.SCRIP_CD || item.SLONGNAME || 'BSE_STOCK')
          .trim()
          .toUpperCase();
        const companyName = String(item.SLONGNAME || symbol).trim();
        const title = String(item.NEWSSUB || item.HEADLINE || 'BSE Corporate Announcement').trim();
        const desc = item.MORE ? String(item.MORE).trim() : null;
        const category = this.mapBseCategory(`${title} ${desc || ''}`);

        if (options.category && category !== options.category) {
          continue;
        }

        const publishedAt = item.DT_TM
          ? new Date(String(item.DT_TM)).toISOString()
          : new Date().toISOString();
        const docFile = item.ATTACHMENTNAME ? String(item.ATTACHMENTNAME).trim() : null;
        const documentUrl = docFile
          ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${docFile}`
          : null;

        results.push({
          providerId: this.id,
          externalId: item.NEWSID ? String(item.NEWSID) : null,
          symbol,
          companyName,
          exchange: 'BSE',
          isin: item.ISIN_CODE ? String(item.ISIN_CODE).trim() : null,
          title,
          category,
          description: desc,
          publishedAt,
          sourceUrl: 'https://www.bseindia.com/corporates/ann.html',
          documentUrl,
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
      logger.warn({ err, options }, 'BSE announcements fetch failed or unavailable');
      return [];
    }
  }
}
