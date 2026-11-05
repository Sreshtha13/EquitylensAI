import { logger } from '../../utils/logger.js';
import { classifyBSESecurity } from './classification.js';
import type { InstrumentRecord, ListingStatus } from '../types.js';

export interface RawBSEScrip {
  SCRIP_CD: string;
  Scrip_Name: string;
  Status: string;
  GROUP: string;
  FACE_VALUE?: string;
  ISIN_NUMBER?: string;
  INDUSTRY?: string | null;
  scrip_id: string;
  Segment: string;
  NSURL?: string;
  Issuer_Name?: string;
  Mktcap?: string;
}

export interface DiscoveredBSERecord extends InstrumentRecord {
  scripCode: string;
  group: string;
  segment: string;
  industry?: string | undefined;
  faceValue?: number | undefined;
}

export interface BSEDiscoveryResult {
  records: DiscoveredBSERecord[];
  activeCount: number;
  suspendedCount: number;
  delistedCount: number;
  mainboardCount: number;
  smeCount: number;
  totalCount: number;
  discoveredAt: string;
  errors: string[];
}

export class BSESecurityDiscoveryProvider {
  private readonly baseUrl = 'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w';
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  private async fetchStatusData(status: 'Active' | 'Suspended' | 'Delisted'): Promise<RawBSEScrip[]> {
    const url = `${this.baseUrl}?Group=&Scripcode=&industry=&segment=Equity&status=${status}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.bseindia.com/',
        Origin: 'https://www.bseindia.com',
      },
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      throw new Error(`BSE API returned HTTP ${res.status} ${res.statusText} for status=${status}`);
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new Error(`Expected array from BSE API, received: ${typeof data}`);
    }

    return data as RawBSEScrip[];
  }

  normalizeBSEScrips(
    rawScrips: RawBSEScrip[],
    listingStatus: ListingStatus,
  ): DiscoveredBSERecord[] {
    const records: DiscoveredBSERecord[] = [];
    const nowIso = new Date().toISOString();

    for (const item of rawScrips) {
      const scripCode = (item.SCRIP_CD || '').trim();
      const scripId = (item.scrip_id || '').trim().toUpperCase();
      if (!scripCode && !scripId) continue;

      // BSE symbol: use scrip_id (e.g. RELIANCE, ABB) or fall back to scrip code
      const symbol = scripId || scripCode;
      const name = (item.Issuer_Name || item.Scrip_Name || symbol).trim();
      const isin = item.ISIN_NUMBER?.trim().toUpperCase();
      const group = (item.GROUP || '').trim().toUpperCase();
      const segment = (item.Segment || 'Equity').trim();
      const faceVal = item.FACE_VALUE ? parseFloat(item.FACE_VALUE) : undefined;

      const { classification, assetType } = classifyBSESecurity(group, segment, name);

      records.push({
        symbol,
        name,
        exchange: 'BSE',
        market: 'bse',
        assetType,
        currency: 'INR',
        scripCode,
        isin: isin && isin.length === 12 ? isin : undefined,
        classification,
        listingStatus,
        group,
        segment,
        industry: item.INDUSTRY ? item.INDUSTRY.trim() : undefined,
        tickSize: 0.05,
        lotSize: 1,
        firstDiscoveredAt: nowIso,
        lastDiscoveredAt: nowIso,
        lastVerifiedAt: nowIso,
        source: 'bse_official',
        faceValue: Number.isFinite(faceVal) ? faceVal : undefined,
        metadata: {
          mktCap: item.Mktcap,
          url: item.NSURL,
        },
      });
    }

    return records;
  }

  /**
   * Executes official BSE discovery across Active, Suspended, and Delisted scrips.
   */
  async discoverBSE(options?: { includeInactive?: boolean }): Promise<BSEDiscoveryResult> {
    const errors: string[] = [];
    let activeRaw: RawBSEScrip[] = [];
    let suspendedRaw: RawBSEScrip[] = [];
    let delistedRaw: RawBSEScrip[] = [];

    // 1. Fetch Active BSE Securities
    try {
      logger.info('Fetching official active BSE securities from API');
      activeRaw = await this.fetchStatusData('Active');
      logger.info({ count: activeRaw.length }, 'Fetched official active BSE securities');
    } catch (err) {
      const msg = `BSE active securities discovery failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error({ err }, msg);
      errors.push(msg);
    }

    // 2. Fetch Suspended BSE Securities (optional / supplementary)
    if (options?.includeInactive) {
      try {
        logger.info('Fetching official suspended BSE securities from API');
        suspendedRaw = await this.fetchStatusData('Suspended');
        logger.info({ count: suspendedRaw.length }, 'Fetched official suspended BSE securities');
      } catch (err) {
        const msg = `BSE suspended discovery non-fatal failure: ${err instanceof Error ? err.message : String(err)}`;
        logger.warn({ err }, msg);
      }

      // 3. Fetch Delisted BSE Securities (optional)
      try {
        logger.info('Fetching official delisted BSE securities from API');
        delistedRaw = await this.fetchStatusData('Delisted');
        logger.info({ count: delistedRaw.length }, 'Fetched official delisted BSE securities');
      } catch (err) {
        const msg = `BSE delisted discovery non-fatal failure: ${err instanceof Error ? err.message : String(err)}`;
        logger.warn({ err }, msg);
      }
    }

    const activeRecords = this.normalizeBSEScrips(activeRaw, 'ACTIVE');
    const suspendedRecords = this.normalizeBSEScrips(suspendedRaw, 'SUSPENDED');
    const delistedRecords = this.normalizeBSEScrips(delistedRaw, 'DELISTED');

    // Combine records avoiding duplicates by scripCode
    const scripMap = new Map<string, DiscoveredBSERecord>();
    for (const rec of activeRecords) {
      scripMap.set(rec.scripCode, rec);
    }
    for (const rec of suspendedRecords) {
      if (!scripMap.has(rec.scripCode)) {
        scripMap.set(rec.scripCode, rec);
      }
    }
    for (const rec of delistedRecords) {
      if (!scripMap.has(rec.scripCode)) {
        scripMap.set(rec.scripCode, rec);
      }
    }

    const allRecords = Array.from(scripMap.values());
    let mainboardCount = 0;
    let smeCount = 0;
    for (const r of allRecords) {
      if (r.classification === 'SME_EQUITY') smeCount++;
      else if (r.classification === 'MAINBOARD_EQUITY') mainboardCount++;
    }

    return {
      records: allRecords,
      activeCount: activeRecords.length,
      suspendedCount: suspendedRecords.length,
      delistedCount: delistedRecords.length,
      mainboardCount,
      smeCount,
      totalCount: allRecords.length,
      discoveredAt: new Date().toISOString(),
      errors,
    };
  }
}

export const bseDiscoveryProvider = new BSESecurityDiscoveryProvider();
