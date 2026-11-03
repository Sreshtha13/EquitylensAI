import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  InstrumentRecord,
  InstrumentSummary,
  Market,
  AssetType,
  SecurityClassification,
  ListingStatus,
} from '../types.js';
import { SEED_INSTRUMENTS } from './seedData.js';
import { logger } from '../../utils/logger.js';

interface NormalizedEntry {
  record: InstrumentRecord;
  symUpper: string;
  nameUpper: string;
  isinUpper: string;
  scripCodeUpper: string;
  historicalUpper: string[];
}

export class InstrumentRepository {
  private instruments: InstrumentRecord[] = [];
  private normalizedIndex: NormalizedEntry[] = [];
  private symbolIndex = new Map<string, InstrumentRecord>();
  private tokenIndex = new Map<string, InstrumentRecord>();
  private exchangeSymbolIndex = new Map<string, InstrumentRecord>();
  private scripCodeIndex = new Map<string, InstrumentRecord>();
  private isinIndex = new Map<string, InstrumentRecord[]>();
  private historicalSymbolIndex = new Map<string, InstrumentRecord>();
  private positionMap = new Map<string, number>();
  private searchCache = new Map<string, { result: InstrumentSummary[]; expiresAt: number }>();
  private readonly MAX_SEARCH_CACHE = 1000;
  private isLoaded = false;

  constructor() {
    this.load(SEED_INSTRUMENTS);
  }

  /**
   * Atomically loads records into memory, completely rebuilding the search indices.
   */
  load(records: InstrumentRecord[]): void {
    const newInstruments: InstrumentRecord[] = [];
    const newNormalizedIndex: NormalizedEntry[] = [];
    const newSymbolIndex = new Map<string, InstrumentRecord>();
    const newTokenIndex = new Map<string, InstrumentRecord>();
    const newExchangeSymbolIndex = new Map<string, InstrumentRecord>();
    const newScripCodeIndex = new Map<string, InstrumentRecord>();
    const newIsinIndex = new Map<string, InstrumentRecord[]>();
    const newHistoricalSymbolIndex = new Map<string, InstrumentRecord>();
    const newPositionMap = new Map<string, number>();

    for (const record of records) {
      const symKey = record.symbol.toUpperCase();
      const exchSymKey = `${record.exchange.toUpperCase()}:${symKey}`;

      newSymbolIndex.set(symKey, record);
      newExchangeSymbolIndex.set(exchSymKey, record);

      if (record.providerToken) {
        newTokenIndex.set(record.providerToken, record);
      }
      if (record.scripCode) {
        newScripCodeIndex.set(record.scripCode, record);
      }
      if (record.isin) {
        const isinKey = record.isin.toUpperCase();
        const existing = newIsinIndex.get(isinKey) ?? [];
        existing.push(record);
        newIsinIndex.set(isinKey, existing);
      }
      if (record.historicalSymbols) {
        for (const oldSym of record.historicalSymbols) {
          newHistoricalSymbolIndex.set(oldSym.toUpperCase(), record);
        }
      }

      const historicalUpper = (record.historicalSymbols ?? []).map((s) => s.toUpperCase());
      const normalizedEntry: NormalizedEntry = {
        record,
        symUpper: symKey,
        nameUpper: record.name.toUpperCase(),
        isinUpper: record.isin ? record.isin.toUpperCase() : '',
        scripCodeUpper: record.scripCode ? record.scripCode.toUpperCase() : '',
        historicalUpper,
      };

      const existingIndex = newPositionMap.get(exchSymKey);
      if (existingIndex !== undefined && existingIndex < newInstruments.length) {
        newInstruments[existingIndex] = record;
        newNormalizedIndex[existingIndex] = normalizedEntry;
      } else {
        const newIndex = newInstruments.length;
        newInstruments.push(record);
        newNormalizedIndex.push(normalizedEntry);
        newPositionMap.set(exchSymKey, newIndex);
      }
    }

    // Atomic assignment
    this.instruments = newInstruments;
    this.normalizedIndex = newNormalizedIndex;
    this.symbolIndex = newSymbolIndex;
    this.tokenIndex = newTokenIndex;
    this.exchangeSymbolIndex = newExchangeSymbolIndex;
    this.scripCodeIndex = newScripCodeIndex;
    this.isinIndex = newIsinIndex;
    this.historicalSymbolIndex = newHistoricalSymbolIndex;
    this.positionMap = newPositionMap;
    this.isLoaded = true;
    this.searchCache.clear();
  }

  upsert(record: InstrumentRecord): void {
    const symKey = record.symbol.toUpperCase();
    const exchSymKey = `${record.exchange.toUpperCase()}:${symKey}`;

    this.symbolIndex.set(symKey, record);
    this.exchangeSymbolIndex.set(exchSymKey, record);

    if (record.providerToken) {
      this.tokenIndex.set(record.providerToken, record);
    }
    if (record.scripCode) {
      this.scripCodeIndex.set(record.scripCode, record);
    }
    if (record.isin) {
      const isinKey = record.isin.toUpperCase();
      const existing = this.isinIndex.get(isinKey) ?? [];
      const filtered = existing.filter(
        (e) => `${e.exchange}:${e.symbol}` !== `${record.exchange}:${record.symbol}`,
      );
      filtered.push(record);
      this.isinIndex.set(isinKey, filtered);
    }
    if (record.historicalSymbols) {
      for (const oldSym of record.historicalSymbols) {
        this.historicalSymbolIndex.set(oldSym.toUpperCase(), record);
      }
    }

    const historicalUpper = (record.historicalSymbols ?? []).map((s) => s.toUpperCase());
    const normalizedEntry: NormalizedEntry = {
      record,
      symUpper: symKey,
      nameUpper: record.name.toUpperCase(),
      isinUpper: record.isin ? record.isin.toUpperCase() : '',
      scripCodeUpper: record.scripCode ? record.scripCode.toUpperCase() : '',
      historicalUpper,
    };

    const existingIndex = this.positionMap.get(exchSymKey);
    if (existingIndex !== undefined && existingIndex < this.instruments.length) {
      this.instruments[existingIndex] = record;
      this.normalizedIndex[existingIndex] = normalizedEntry;
    } else {
      const newIndex = this.instruments.length;
      this.instruments.push(record);
      this.normalizedIndex.push(normalizedEntry);
      this.positionMap.set(exchSymKey, newIndex);
    }

    this.searchCache.clear();
  }

  getBySymbol(symbol: string, exchange?: string): InstrumentRecord | undefined {
    const clean = symbol.trim().toUpperCase();

    if (exchange) {
      const match = this.exchangeSymbolIndex.get(`${exchange.toUpperCase()}:${clean}`);
      if (match) return match;
    }

    // Direct symbol match
    const direct = this.symbolIndex.get(clean);
    if (direct) return direct;

    // Check by BSE Scrip Code (e.g. '500325')
    const byScripCode = this.scripCodeIndex.get(clean);
    if (byScripCode) return byScripCode;

    // Check by ISIN (e.g. 'INE002A01018')
    const byIsinList = this.isinIndex.get(clean);
    if (byIsinList && byIsinList.length > 0) {
      if (exchange) {
        const exchMatch = byIsinList.find(
          (r) => r.exchange.toUpperCase() === exchange.toUpperCase(),
        );
        if (exchMatch) return exchMatch;
      }
      return byIsinList[0];
    }

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

    // Check historical symbol alias
    const historicalMatch = this.historicalSymbolIndex.get(clean);
    if (historicalMatch) return historicalMatch;

    return undefined;
  }

  findBySymbol(symbol: string, exchange?: string): InstrumentRecord | undefined {
    return this.getBySymbol(symbol, exchange);
  }

  getByToken(token: string): InstrumentRecord | undefined {
    return this.tokenIndex.get(token);
  }

  getByIsin(isin: string, exchange?: string): InstrumentRecord[] {
    const list = this.isinIndex.get(isin.trim().toUpperCase()) ?? [];
    if (exchange) {
      return list.filter((r) => r.exchange.toUpperCase() === exchange.toUpperCase());
    }
    return list;
  }

  search(
    query: string,
    options?: {
      market?: Market | undefined;
      exchange?: string | undefined;
      assetType?: AssetType | undefined;
      classification?: SecurityClassification | undefined;
      listingStatus?: ListingStatus | undefined;
      limit?: number | undefined;
    },
  ): InstrumentSummary[] {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    const limit = options?.limit ?? 20;
    const cacheKey = `${q}:${options?.market || 'all'}:${options?.exchange || 'all'}:${options?.assetType || 'all'}:${options?.classification || 'all'}:${options?.listingStatus || 'all'}:${limit}`;

    const now = Date.now();
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const scored: { item: InstrumentRecord; score: number }[] = [];

    for (let i = 0; i < this.normalizedIndex.length; i++) {
      const entry = this.normalizedIndex[i]!;
      const item = entry.record;

      if (options?.market && item.market !== options.market) continue;
      if (options?.exchange && item.exchange.toUpperCase() !== options.exchange.toUpperCase()) {
        continue;
      }
      if (options?.assetType && item.assetType !== options.assetType) continue;
      if (options?.classification && item.classification !== options.classification) continue;
      if (options?.listingStatus && item.listingStatus !== options.listingStatus) continue;

      const sym = entry.symUpper;
      const name = entry.nameUpper;
      const isin = entry.isinUpper;
      const scripCode = entry.scripCodeUpper;

      let score = 0;

      if (sym === q) {
        score = 100;
      } else if (isin === q) {
        score = 95;
      } else if (scripCode === q) {
        score = 90;
      } else if (sym.startsWith(q)) {
        score = 80;
      } else if (entry.historicalUpper.includes(q)) {
        score = 75;
      } else if (sym.includes(q)) {
        score = 60;
      } else if (name.startsWith(q)) {
        score = 40;
      } else if (name.includes(q)) {
        score = 20;
      } else if (entry.historicalUpper.some((h) => h.startsWith(q))) {
        score = 15;
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.symbol.localeCompare(b.item.symbol);
    });

    const result = scored.slice(0, limit).map((s) => ({
      symbol: s.item.symbol,
      name: s.item.name,
      exchange: s.item.exchange,
      market: s.item.market,
      assetType: s.item.assetType,
      currency: s.item.currency,
      providerToken: s.item.providerToken,
      isin: s.item.isin,
      classification: s.item.classification,
      listingStatus: s.item.listingStatus,
      scripCode: s.item.scripCode,
      series: s.item.series,
    }));

    if (this.searchCache.size >= this.MAX_SEARCH_CACHE) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) this.searchCache.delete(oldestKey);
    }
    this.searchCache.set(cacheKey, { result, expiresAt: now + 300_000 }); // 5m TTL

    return result;
  }

  count(): number {
    return this.instruments.length;
  }

  list(options?: {
    market?: Market;
    assetType?: AssetType;
    exchange?: string;
    classification?: SecurityClassification;
    listingStatus?: ListingStatus;
  }): InstrumentRecord[] {
    return this.instruments.filter(
      (item) =>
        (!options?.market || item.market === options.market) &&
        (!options?.assetType || item.assetType === options.assetType) &&
        (!options?.exchange || item.exchange.toUpperCase() === options.exchange.toUpperCase()) &&
        (!options?.classification || item.classification === options.classification) &&
        (!options?.listingStatus || item.listingStatus === options.listingStatus),
    );
  }

  /**
   * Atomically saves instruments cache to disk by writing to a temporary file
   * first and then replacing the destination file.
   */
  async saveToDisk(cacheFilePath: string): Promise<void> {
    const tempPath = `${cacheFilePath}.tmp.${Date.now()}`;
    try {
      await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      await fs.writeFile(tempPath, JSON.stringify(this.instruments, null, 2), 'utf-8');
      await fs.rename(tempPath, cacheFilePath);
      logger.info(
        { count: this.instruments.length, path: cacheFilePath },
        'Atomically saved instruments cache to disk',
      );
    } catch (err) {
      logger.error({ err, path: cacheFilePath }, 'Failed to save instruments cache to disk');
      try {
        await fs.unlink(tempPath).catch(() => {});
      } catch {
        // ignore cleanup error
      }
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
      classification: inst.classification ?? 'MAINBOARD_EQUITY',
      scrip_code: inst.scripCode ?? null,
      series: inst.series ?? null,
      listing_status: inst.listingStatus ?? 'ACTIVE',
      asset_type: inst.assetType || 'equity',
      currency: inst.currency || 'INR',
      provider_token: inst.providerToken ?? null,
      tick_size: inst.tickSize ?? 0.05,
      lot_size: inst.lotSize ?? 1,
      is_active: inst.listingStatus !== 'DELISTED',
      data_completeness: inst.dataCompleteness ?? (inst.isin ? 'COMPLETE' : 'PARTIAL'),
      historical_symbols: inst.historicalSymbols ?? [],
      metadata: inst.metadata ?? {},
      source: inst.source || 'canonical_reconciliation',
      first_discovered_at: inst.firstDiscoveredAt || new Date().toISOString(),
      last_discovered_at: inst.lastDiscoveredAt || new Date().toISOString(),
      last_verified_at: inst.lastVerifiedAt || new Date().toISOString(),
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
      const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/market_instruments?is_active=eq.true&order=symbol.asc&limit=15000`;
      const res = await fetch(url, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
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
        classification?: SecurityClassification | null;
        listing_status?: ListingStatus | null;
        scrip_code?: string | null;
        series?: string | null;
        tick_size?: number | null;
        lot_size?: number | null;
        first_discovered_at?: string | null;
        last_discovered_at?: string | null;
        last_verified_at?: string | null;
        data_completeness?: 'COMPLETE' | 'PARTIAL' | 'BASIC' | null;
        historical_symbols?: string[] | null;
        metadata?: Record<string, unknown> | null;
        source?: string | null;
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
          classification: d.classification ?? 'MAINBOARD_EQUITY',
          listingStatus: d.listing_status ?? 'ACTIVE',
          scripCode: d.scrip_code ?? undefined,
          series: d.series ?? undefined,
          tickSize: d.tick_size !== null && d.tick_size !== undefined ? Number(d.tick_size) : undefined,
          lotSize: d.lot_size !== null && d.lot_size !== undefined ? Number(d.lot_size) : undefined,
          firstDiscoveredAt: d.first_discovered_at ?? undefined,
          lastDiscoveredAt: d.last_discovered_at ?? undefined,
          lastVerifiedAt: d.last_verified_at ?? undefined,
          dataCompleteness: d.data_completeness ?? undefined,
          historicalSymbols: d.historical_symbols ?? undefined,
          metadata: d.metadata ?? undefined,
          source: d.source ?? undefined,
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
