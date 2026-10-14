import fs from 'node:fs/promises';
import path from 'node:path';
import type { InstrumentRecord, InstrumentSummary, Market, AssetType } from '../types.js';
import { SEED_INSTRUMENTS } from './seedData.js';
import { logger } from '../../utils/logger.js';

export class InstrumentRepository {
  private instruments: InstrumentRecord[] = [];
  private symbolIndex = new Map<string, InstrumentRecord>();
  private tokenIndex = new Map<string, InstrumentRecord>();
  private exchangeSymbolIndex = new Map<string, InstrumentRecord>();
  private isLoaded = false;

  constructor() {
    this.load(SEED_INSTRUMENTS);
  }

  load(records: InstrumentRecord[]): void {
    // Preserve existing records by key, overlaying new ones
    for (const record of records) {
      this.upsert(record);
    }
    this.isLoaded = true;
  }

  upsert(record: InstrumentRecord): void {
    const symKey = record.symbol.toUpperCase();
    const exchSymKey = `${record.exchange.toUpperCase()}:${symKey}`;

    this.symbolIndex.set(symKey, record);
    this.exchangeSymbolIndex.set(exchSymKey, record);

    if (record.providerToken) {
      this.tokenIndex.set(record.providerToken, record);
    }

    // Replace if existing or append
    const existingIndex = this.instruments.findIndex(
      (i) => i.symbol.toUpperCase() === symKey && i.exchange.toUpperCase() === record.exchange.toUpperCase()
    );

    if (existingIndex >= 0) {
      this.instruments[existingIndex] = record;
    } else {
      this.instruments.push(record);
    }
  }

  getBySymbol(symbol: string, exchange?: string): InstrumentRecord | undefined {
    const clean = symbol.trim().toUpperCase();

    if (exchange) {
      const match = this.exchangeSymbolIndex.get(`${exchange.toUpperCase()}:${clean}`);
      if (match) return match;
    }

    // Direct match
    const direct = this.symbolIndex.get(clean);
    if (direct) return direct;

    // Handle symbols ending with .NS or .BO
    if (clean.endsWith('.NS')) {
      const bare = clean.slice(0, -3);
      return this.getBySymbol(bare, 'NSE');
    }
    if (clean.endsWith('.BO')) {
      const bare = clean.slice(0, -3);
      return this.getBySymbol(bare, 'BSE');
    }

    // Handle symbols ending with -EQ
    if (clean.endsWith('-EQ')) {
      const bare = clean.slice(0, -3);
      return this.getBySymbol(bare, exchange);
    }

    return undefined;
  }

  getByToken(token: string): InstrumentRecord | undefined {
    return this.tokenIndex.get(token);
  }

  search(
    query: string,
    options?: {
      market?: Market | undefined;
      assetType?: AssetType | undefined;
      limit?: number | undefined;
    }
  ): InstrumentSummary[] {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    const limit = options?.limit ?? 20;
    const scored: { item: InstrumentRecord; score: number }[] = [];

    for (const item of this.instruments) {
      if (options?.market && item.market !== options.market) continue;
      if (options?.assetType && item.assetType !== options.assetType) continue;

      const sym = item.symbol.toUpperCase();
      const name = item.name.toUpperCase();

      let score = 0;

      if (sym === q) {
        score = 100;
      } else if (sym.startsWith(q)) {
        score = 80;
      } else if (sym.includes(q)) {
        score = 60;
      } else if (name.startsWith(q)) {
        score = 40;
      } else if (name.includes(q)) {
        score = 20;
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.symbol.localeCompare(b.item.symbol);
    });

    return scored.slice(0, limit).map((s) => ({
      symbol: s.item.symbol,
      name: s.item.name,
      exchange: s.item.exchange,
      market: s.item.market,
      assetType: s.item.assetType,
      currency: s.item.currency,
      providerToken: s.item.providerToken,
      isin: s.item.isin,
    }));
  }

  count(): number {
    return this.instruments.length;
  }

  async saveToDisk(cacheFilePath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.writeFile(cacheFilePath, JSON.stringify(this.instruments, null, 2), 'utf-8');
      logger.info({ count: this.instruments.length, path: cacheFilePath }, 'Saved instruments cache to disk');
    } catch (err) {
      logger.error({ err, path: cacheFilePath }, 'Failed to save instruments cache to disk');
    }
  }

  async loadFromDisk(cacheFilePath: string): Promise<boolean> {
    try {
      const data = await fs.readFile(cacheFilePath, 'utf-8');
      const records = JSON.parse(data) as InstrumentRecord[];
      if (Array.isArray(records) && records.length > 0) {
        this.load(records);
        logger.info({ count: records.length, path: cacheFilePath }, 'Loaded instruments cache from disk');
        return true;
      }
    } catch {
      // File does not exist yet; normal on fresh run
    }
    return false;
  }
}

export const instrumentRepository = new InstrumentRepository();
