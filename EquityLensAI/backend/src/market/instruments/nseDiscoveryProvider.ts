import { logger } from '../../utils/logger.js';
import { classifyNSESecurity } from './classification.js';
import type { InstrumentRecord, SecurityClassification, ListingStatus } from '../types.js';

export interface DiscoveredNSERecord extends InstrumentRecord {
  series: string;
  listingDate?: string | undefined;
  marketLot?: number | undefined;
  faceValue?: number | undefined;
}

export interface SymbolChangeRecord {
  companyName: string;
  oldSymbol: string;
  newSymbol: string;
  effectiveDate: string;
}

export interface NameChangeRecord {
  symbol: string;
  oldName: string;
  newName: string;
  effectiveDate: string;
}

export interface NSEDiscoveryResult {
  records: DiscoveredNSERecord[];
  symbolChanges: SymbolChangeRecord[];
  nameChanges: NameChangeRecord[];
  mainboardCount: number;
  smeCount: number;
  totalCount: number;
  discoveredAt: string;
  sourceUrls: string[];
  errors: string[];
}

export class NSESecurityDiscoveryProvider {
  private readonly equityUrl = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
  private readonly smeEquityUrl =
    'https://nsearchives.nseindia.com/content/equities/SME_EQUITY_L.csv';
  private readonly symbolChangeUrl =
    'https://nsearchives.nseindia.com/content/equities/symbolchange.csv';
  private readonly nameChangeUrl =
    'https://nsearchives.nseindia.com/content/equities/namechange.csv';

  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  /**
   * Parses standard CSV text with RFC 4180 quote support.
   */
  parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/);
    const rows: string[][] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('**') || line.startsWith('#')) {
        continue;
      }

      const row: string[] = [];
      let inQuotes = false;
      let currentValue = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            currentValue += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      row.push(currentValue.trim());

      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
    }

    return rows;
  }

  private async fetchText(url: string, timeoutMs = 30000): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'text/csv,text/plain,*/*',
        Referer: 'https://www.nseindia.com/',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status} ${res.statusText}`);
    }

    return await res.text();
  }

  /**
   * Parses equity or SME equity CSV into structured DiscoveredNSERecords.
   */
  parseEquityCSV(
    csvText: string,
    forcedClassification?: SecurityClassification,
  ): DiscoveredNSERecord[] {
    const rows = this.parseCSV(csvText);
    if (rows.length < 2) return [];

    const header = rows[0]!.map((col) => col.trim().toUpperCase());
    const symIdx = header.findIndex((h) => h === 'SYMBOL');
    const nameIdx = header.findIndex((h) => h === 'NAME OF COMPANY');
    const seriesIdx = header.findIndex((h) => h === 'SERIES');
    const isinIdx = header.findIndex((h) => h === 'ISIN NUMBER');
    const dateIdx = header.findIndex((h) => h === 'DATE OF LISTING');
    const lotIdx = header.findIndex((h) => h === 'MARKET LOT');
    const faceIdx = header.findIndex((h) => h === 'FACE VALUE');

    if (symIdx === -1 || nameIdx === -1) {
      throw new Error(
        `Invalid NSE equity CSV structure; missing SYMBOL or NAME OF COMPANY in header: ${header.join(',')}`,
      );
    }

    const records: DiscoveredNSERecord[] = [];
    const nowIso = new Date().toISOString();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      const rawSym = row[symIdx];
      if (!rawSym) continue;

      const symbol = rawSym.trim().toUpperCase();
      const name = (row[nameIdx] || symbol).trim();
      const series = seriesIdx !== -1 && row[seriesIdx] ? row[seriesIdx]!.trim().toUpperCase() : 'EQ';
      const isin = isinIdx !== -1 && row[isinIdx] ? row[isinIdx]!.trim().toUpperCase() : undefined;
      const listingDate = dateIdx !== -1 ? row[dateIdx]?.trim() : undefined;
      const lot = lotIdx !== -1 && row[lotIdx] ? parseInt(row[lotIdx]!, 10) : 1;
      const faceVal = faceIdx !== -1 && row[faceIdx] ? parseFloat(row[faceIdx]!) : undefined;

      const { classification, assetType } = forcedClassification
        ? { classification: forcedClassification, assetType: 'equity' as const }
        : classifyNSESecurity(series, symbol, name);

      records.push({
        symbol,
        name,
        exchange: 'NSE',
        market: 'nse',
        assetType,
        currency: 'INR',
        isin: isin && isin.length === 12 ? isin : undefined,
        series,
        classification,
        listingStatus: 'ACTIVE' as ListingStatus,
        lotSize: Number.isFinite(lot) && lot > 0 ? lot : 1,
        tickSize: 0.05,
        firstDiscoveredAt: nowIso,
        lastDiscoveredAt: nowIso,
        lastVerifiedAt: nowIso,
        source: 'nse_official',
        listingDate,
        marketLot: lot,
        faceValue: faceVal,
      });
    }

    return records;
  }

  /**
   * Parses symbol changes CSV from official NSE.
   */
  parseSymbolChanges(csvText: string): SymbolChangeRecord[] {
    const rows = this.parseCSV(csvText);
    if (rows.length < 2) return [];

    const header = rows[0]!.map((col) => col.trim().toUpperCase());
    const nameIdx = header.findIndex((h) => h.includes('COMPANY'));
    const oldSymIdx = header.findIndex((h) => h.includes('OLD SYMBOL'));
    const newSymIdx = header.findIndex((h) => h.includes('NEW SYMBOL'));
    const dateIdx = header.findIndex((h) => h.includes('EFFECTIVE DATE'));

    if (oldSymIdx === -1 || newSymIdx === -1) {
      return [];
    }

    const changes: SymbolChangeRecord[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      const oldSymbol = row[oldSymIdx]?.trim().toUpperCase();
      const newSymbol = row[newSymIdx]?.trim().toUpperCase();
      if (!oldSymbol || !newSymbol) continue;

      changes.push({
        companyName: nameIdx !== -1 ? (row[nameIdx]?.trim() ?? '') : '',
        oldSymbol,
        newSymbol,
        effectiveDate: dateIdx !== -1 ? (row[dateIdx]?.trim() ?? '') : '',
      });
    }

    return changes;
  }

  /**
   * Parses name changes CSV from official NSE.
   */
  parseNameChanges(csvText: string): NameChangeRecord[] {
    const rows = this.parseCSV(csvText);
    if (rows.length < 2) return [];

    const header = rows[0]!.map((col) => col.trim().toUpperCase());
    const symIdx = header.findIndex((h) => h === 'SYMBOL');
    const oldNameIdx = header.findIndex((h) => h.includes('OLD NAME'));
    const newNameIdx = header.findIndex((h) => h.includes('NEW NAME'));
    const dateIdx = header.findIndex((h) => h.includes('EFFECTIVE DATE'));

    if (symIdx === -1 || newNameIdx === -1) {
      return [];
    }

    const changes: NameChangeRecord[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      const symbol = row[symIdx]?.trim().toUpperCase();
      const newName = row[newNameIdx]?.trim();
      if (!symbol || !newName) continue;

      changes.push({
        symbol,
        oldName: oldNameIdx !== -1 ? (row[oldNameIdx]?.trim() ?? '') : '',
        newName,
        effectiveDate: dateIdx !== -1 ? (row[dateIdx]?.trim() ?? '') : '',
      });
    }

    return changes;
  }

  /**
   * Executes complete official NSE discovery across mainboard equities, SME equities,
   * symbol changes, and name changes.
   */
  async discoverNSE(): Promise<NSEDiscoveryResult> {
    const errors: string[] = [];
    const sourceUrls: string[] = [];
    let mainboardRecords: DiscoveredNSERecord[] = [];
    let smeRecords: DiscoveredNSERecord[] = [];
    let symbolChanges: SymbolChangeRecord[] = [];
    let nameChanges: NameChangeRecord[] = [];

    // 1. Fetch Mainboard Equities
    try {
      logger.info({ url: this.equityUrl }, 'Fetching official NSE mainboard equities');
      sourceUrls.push(this.equityUrl);
      const csv = await this.fetchText(this.equityUrl);
      mainboardRecords = this.parseEquityCSV(csv);
      logger.info(
        { count: mainboardRecords.length },
        'Successfully parsed NSE mainboard securities',
      );
    } catch (err) {
      const msg = `NSE mainboard equity discovery failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error({ err }, msg);
      errors.push(msg);
    }

    // 2. Fetch SME Equities
    try {
      logger.info({ url: this.smeEquityUrl }, 'Fetching official NSE SME equities');
      sourceUrls.push(this.smeEquityUrl);
      const csv = await this.fetchText(this.smeEquityUrl);
      smeRecords = this.parseEquityCSV(csv, 'SME_EQUITY');
      logger.info({ count: smeRecords.length }, 'Successfully parsed NSE SME securities');
    } catch (err) {
      const msg = `NSE SME equity discovery failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn({ err }, msg);
      errors.push(msg);
    }

    // 3. Fetch Symbol Changes
    try {
      sourceUrls.push(this.symbolChangeUrl);
      const csv = await this.fetchText(this.symbolChangeUrl);
      symbolChanges = this.parseSymbolChanges(csv);
      logger.info({ count: symbolChanges.length }, 'Parsed NSE symbol changes history');
    } catch (err) {
      const msg = `NSE symbol changes fetch non-fatal failure: ${err instanceof Error ? err.message : String(err)}`;
      logger.debug({ err }, msg);
    }

    // 4. Fetch Name Changes
    try {
      sourceUrls.push(this.nameChangeUrl);
      const csv = await this.fetchText(this.nameChangeUrl);
      nameChanges = this.parseNameChanges(csv);
      logger.info({ count: nameChanges.length }, 'Parsed NSE company name changes history');
    } catch (err) {
      const msg = `NSE name changes fetch non-fatal failure: ${err instanceof Error ? err.message : String(err)}`;
      logger.debug({ err }, msg);
    }

    // Merge mainboard and SME into unified list (deduping by symbol)
    const recordMap = new Map<string, DiscoveredNSERecord>();
    for (const rec of mainboardRecords) {
      recordMap.set(rec.symbol, rec);
    }
    for (const rec of smeRecords) {
      recordMap.set(rec.symbol, rec);
    }

    const records = Array.from(recordMap.values());

    return {
      records,
      symbolChanges,
      nameChanges,
      mainboardCount: mainboardRecords.length,
      smeCount: smeRecords.length,
      totalCount: records.length,
      discoveredAt: new Date().toISOString(),
      sourceUrls,
      errors,
    };
  }
}

export const nseDiscoveryProvider = new NSESecurityDiscoveryProvider();
