import { logger } from '../../utils/logger.js';
import type { InstrumentRecord } from '../types.js';

export const ANGEL_SCRIP_MASTER_URL =
  'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

export interface AngelScrip {
  token: string;
  symbol: string;
  name: string;
  expiry?: string;
  strike?: string;
  lotsize?: string;
  instrumenttype?: string;
  exch_seg: string;
  tick_size?: string;
}

export interface AngelDiscoveryResult {
  records: InstrumentRecord[];
  totalScrips: number;
  equityCount: number;
  indicesCount: number;
  discoveredAt: string;
}

export class AngelDiscoveryProvider {
  /**
   * Normalizes Angel One scrips into InstrumentRecords (keeping existing working behavior).
   */
  normalizeAngelScrips(scrips: AngelScrip[]): InstrumentRecord[] {
    const records: InstrumentRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const item of scrips) {
      if (!item.token || !item.symbol) continue;

      const isNseEquity = item.exch_seg === 'NSE' && item.symbol.endsWith('-EQ');
      const isBseEquity =
        item.exch_seg === 'BSE' && (item.instrumenttype === 'EQ' || item.symbol.endsWith('-EQ'));

      if (isNseEquity || isBseEquity) {
        const exchange = item.exch_seg as 'NSE' | 'BSE';
        const cleanSymbol = item.symbol.endsWith('-EQ') ? item.symbol.slice(0, -3) : item.symbol;
        const tick = item.tick_size ? parseFloat(item.tick_size) / 100 : 0.05;
        const lot = item.lotsize ? parseInt(item.lotsize, 10) : 1;

        records.push({
          symbol: cleanSymbol,
          name: item.name || cleanSymbol,
          exchange,
          market: exchange === 'NSE' ? 'nse' : 'bse',
          assetType: 'equity',
          currency: 'INR',
          providerToken: item.token,
          tickSize: Number.isFinite(tick) && tick > 0 ? tick : 0.05,
          lotSize: Number.isFinite(lot) && lot > 0 ? lot : 1,
          source: 'angel_scrip_master',
          firstDiscoveredAt: nowIso,
          lastDiscoveredAt: nowIso,
          lastVerifiedAt: nowIso,
          dataCompleteness: 'COMPLETE',
        });
      } else if (item.exch_seg === 'NSE' && item.instrumenttype === 'AMXIDX') {
        const symbol = item.name || item.symbol;
        records.push({
          symbol: symbol.toUpperCase().replace(/\s+/g, ''),
          name: item.symbol,
          exchange: 'NSE',
          market: 'nse',
          assetType: 'index',
          currency: 'INR',
          providerToken: item.token,
          source: 'angel_scrip_master',
          firstDiscoveredAt: nowIso,
          lastDiscoveredAt: nowIso,
          lastVerifiedAt: nowIso,
        });
      }
    }

    return records;
  }

  /**
   * Downloads Angel One OpenAPI scrip master file.
   */
  async fetchScripMaster(): Promise<AngelScrip[]> {
    logger.info({ url: ANGEL_SCRIP_MASTER_URL }, 'Downloading Angel One OpenAPI scrip master');

    const response = await fetch(ANGEL_SCRIP_MASTER_URL, {
      headers: {
        'User-Agent': 'EquityLensAI/1.0 (MarketDataIngestion; Node.js)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(60_000), // 60s timeout for ~35MB download
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download Angel One scrip master: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const scrips = (await response.json()) as AngelScrip[];
    return scrips;
  }

  async discoverAngel(): Promise<AngelDiscoveryResult> {
    const scrips = await this.fetchScripMaster();
    const records = this.normalizeAngelScrips(scrips);

    let equityCount = 0;
    let indicesCount = 0;
    for (const r of records) {
      if (r.assetType === 'equity') equityCount++;
      else if (r.assetType === 'index') indicesCount++;
    }

    return {
      records,
      totalScrips: scrips.length,
      equityCount,
      indicesCount,
      discoveredAt: new Date().toISOString(),
    };
  }
}

export const angelDiscoveryProvider = new AngelDiscoveryProvider();
