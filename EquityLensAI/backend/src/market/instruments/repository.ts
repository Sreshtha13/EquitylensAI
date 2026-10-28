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
      (i) =>
        i.symbol.toUpperCase() === symKey &&
        i.exchange.toUpperCase() === record.exchange.toUpperCase(),
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
    },
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

  list(options?: {
    market?: Market;
    assetType?: AssetType;
    exchange?: string;
  }): InstrumentRecord[] {
    return this.instruments.filter(
      (item) =>
        (!options?.market || item.market === options.market) &&
        (!options?.assetType || item.assetType === options.assetType) &&
        (!options?.exchange || item.exchange.toUpperCase() === options.exchange.toUpperCase()),
    );
  }

  async saveToDisk(cacheFilePath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.writeFile(cacheFilePath, JSON.stringify(this.instruments, null, 2), 'utf-8');
      logger.info(
        { count: this.instruments.length, path: cacheFilePath },
        'Saved instruments cache to disk',
      );
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
        logger.info(
          { count: records.length, path: cacheFilePath },
          'Loaded instruments cache from disk',
        );
        return true;
      }
    } catch {
      // File does not exist yet; normal on fresh run
    }
    return false;
  }

  /**
   * Syncs the canonical security universe to Supabase PostgreSQL idempotently.
   */
  async syncToDatabase(): Promise<number> {
    const { getEnv } = await import('../../config/index.js');
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.warn('Supabase credentials not configured; skipping instrument DB sync');
      return 0;
    }

    const rows = this.instruments.map((inst) => ({
      exchange: inst.exchange.toUpperCase(),
      symbol: inst.symbol.toUpperCase(),
      name: inst.name,
      isin: inst.isin ?? null,
      asset_type: inst.assetType || 'equity',
      currency: inst.currency || 'INR',
      provider_token: inst.providerToken ?? null,
      tick_size: inst.tickSize ?? 0.05,
      lot_size: inst.lotSize ?? 1,
      is_active: true,
      source: 'angel_scrip_master',
      updated_at: new Date().toISOString(),
    }));

    const BATCH_SIZE = 100;
    let synced = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/market_instruments?on_conflict=exchange,symbol`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          synced += batch.length;
        }
      } catch (err) {
        logger.warn({ err, batchIndex: i }, 'Failed to sync instrument batch to Supabase');
      }
    }

    logger.info({ synced, total: this.instruments.length }, 'Synced security master to PostgreSQL');
    return synced;
  }

  /**
   * Hydrates the in-memory repository from the canonical PostgreSQL security master.
   */
  async syncFromDatabase(): Promise<boolean> {
    const { getEnv } = await import('../../config/index.js');
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return false;
    }

    try {
      const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/market_instruments?is_active=eq.true&order=symbol.asc&limit=5000`;
      const res = await fetch(url, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) return false;
      const data = (await res.json()) as Array<{
        symbol: string;
        name: string;
        exchange: string;
        asset_type: AssetType;
        currency: string;
        provider_token?: string | null;
        isin?: string | null;
        tick_size?: number;
        lot_size?: number;
      }>;

      if (Array.isArray(data) && data.length > 0) {
        const records: InstrumentRecord[] = data.map((d) => ({
          symbol: d.symbol,
          name: d.name,
          exchange: d.exchange as 'NSE' | 'BSE',
          market: d.exchange.toLowerCase() as Market,
          assetType: d.asset_type,
          currency: d.currency,
          providerToken: d.provider_token ?? undefined,
          isin: d.isin ?? undefined,
          tickSize: d.tick_size !== undefined ? Number(d.tick_size) : undefined,
          lotSize: d.lot_size !== undefined ? Number(d.lot_size) : undefined,
        }));

        this.load(records);
        logger.info({ count: records.length }, 'Loaded instruments from canonical PostgreSQL master');
        return true;
      }
    } catch (err) {
      logger.debug({ err }, 'Could not sync instruments from PostgreSQL, using local universe');
    }
    return false;
  }
}

export const instrumentRepository = new InstrumentRepository();
