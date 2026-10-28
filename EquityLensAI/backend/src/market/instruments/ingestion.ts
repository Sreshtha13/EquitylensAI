import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstrumentRecord } from '../types.js';
import { instrumentRepository } from './repository.js';
import { SEED_INSTRUMENTS } from './seedData.js';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_PATH = path.resolve(__dirname, '../../../data/instruments-cache.json');

const ANGEL_SCRIP_MASTER_URL =
  'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

type AngelScrip = {
  token: string;
  symbol: string;
  name: string;
  expiry?: string;
  strike?: string;
  lotsize?: string;
  instrumenttype?: string;
  exch_seg: string;
  tick_size?: string;
};

export function normalizeAngelScrips(scrips: AngelScrip[]): InstrumentRecord[] {
  const records = [...SEED_INSTRUMENTS];

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
        tickSize: Number.isFinite(tick) ? tick : 0.05,
        lotSize: Number.isFinite(lot) ? lot : 1,
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
      });
    }
  }

  return records;
}

export type IngestionStatus = {
  isIngesting: boolean;
  lastIngestedAt: string | null;
  totalInstruments: number;
  lastError: string | null;
};

let isIngesting = false;
let lastIngestedAt: string | null = null;
let lastError: string | null = null;

export function getIngestionStatus(): IngestionStatus {
  return {
    isIngesting,
    lastIngestedAt,
    totalInstruments: instrumentRepository.count(),
    lastError,
  };
}

export async function ingestInstruments(cachePath: string = DEFAULT_CACHE_PATH): Promise<{
  ingestedCount: number;
  durationMs: number;
}> {
  if (isIngesting) {
    throw new Error('Instrument ingestion is already in progress');
  }

  const startTime = Date.now();
  isIngesting = true;
  lastError = null;

  try {
    logger.info({ url: ANGEL_SCRIP_MASTER_URL }, 'Starting Angel One scrip master download');

    const response = await fetch(ANGEL_SCRIP_MASTER_URL, {
      headers: {
        'User-Agent': 'EquityLensAI/1.0 (MarketDataIngestion; Node.js)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(60_000), // 60s timeout for ~35MB download
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download scrip master: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const scrips = (await response.json()) as AngelScrip[];
    logger.info({ rawCount: scrips.length }, 'Downloaded raw scrip master, normalizing records');

    const normalizedRecords = normalizeAngelScrips(scrips);

    instrumentRepository.load(normalizedRecords);
    await instrumentRepository.saveToDisk(cachePath);

    // Synchronize to canonical PostgreSQL security master if configured
    try {
      await instrumentRepository.syncToDatabase();
    } catch (dbErr) {
      logger.warn({ dbErr }, 'Non-fatal: could not synchronize instruments to PostgreSQL');
    }

    lastIngestedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    logger.info(
      { total: instrumentRepository.count(), durationMs },
      'Successfully completed instrument ingestion',
    );

    return {
      ingestedCount: instrumentRepository.count(),
      durationMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastError = msg;
    logger.error({ err }, 'Instrument ingestion failed');
    throw err;
  } finally {
    isIngesting = false;
  }
}

/**
 * Initializes the repository on startup:
 * 1. Attempts to hydrate from canonical PostgreSQL database.
 * 2. Attempts to load from disk cache if present.
 * 3. Otherwise keeps seed data.
 */
export async function initializeInstruments(
  cachePath: string = DEFAULT_CACHE_PATH,
): Promise<boolean> {
  const dbLoaded = await instrumentRepository.syncFromDatabase().catch(() => false);
  if (dbLoaded) {
    return true;
  }

  const loaded = await instrumentRepository.loadFromDisk(cachePath);
  if (!loaded) {
    logger.info(
      { count: instrumentRepository.count() },
      'No disk cache found; initialized with seed instruments. Run ingestion to load full scrip universe.',
    );
  }
  return loaded;
}
