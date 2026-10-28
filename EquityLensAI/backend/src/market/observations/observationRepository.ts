import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { PriceCandle } from '../types.js';

export interface DailyObservationRecord {
  exchange: string;
  symbol: string;
  tradingDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  currency: string;
  source: string;
  adjustmentStatus: 'unadjusted' | 'split_adjusted' | 'fully_adjusted';
  qualityFlag: 'verified' | 'suspect' | 'reconciled';
}

interface DailyObservationDbRow {
  id: string;
  exchange: string;
  symbol: string;
  trading_date: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string | null;
  currency: string;
  source: string;
  adjustment_status: string;
  quality_flag: string;
  ingested_at: string;
}

class MemoryObservationStore {
  // Keyed by `${exchange}:${symbol}:${date}`
  observations = new Map<string, DailyObservationRecord>();

  clear(): void {
    this.observations.clear();
  }
}

export const memoryObservationStore = new MemoryObservationStore();

async function supabaseRest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<{ data: T | null; status: number; ok: boolean }> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { data: null, status: 503, ok: false };
  }

  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${resource}`;
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { data: null, status: res.status, ok: false };
    }

    const text = await res.text();
    const data = text.trim().length > 0 ? (JSON.parse(text) as T) : null;
    return { data, status: res.status, ok: true };
  } catch (error) {
    logger.debug({ error, resource }, 'Supabase PostgREST request failed, using memory store');
    return { data: null, status: 500, ok: false };
  }
}

export class ObservationRepository {
  /**
   * Retrieves durable historical daily observations from PostgreSQL.
   */
  async getDailySeries(
    exchange: string,
    symbol: string,
    fromDate: string,
    toDate: string,
  ): Promise<PriceCandle[]> {
    const cleanSym = symbol.trim().toUpperCase();
    const cleanExch = exchange.trim().toUpperCase();
    const cleanFrom = fromDate.split('T')[0] ?? fromDate;
    const cleanTo = toDate.split('T')[0] ?? toDate;

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const query = `market_daily_observations?exchange=eq.${cleanExch}&symbol=eq.${cleanSym}&trading_date=gte.${cleanFrom}&trading_date=lte.${cleanTo}&order=trading_date.asc&limit=5000`;
      const { data, ok } = await supabaseRest<DailyObservationDbRow[]>(query);
      if (ok && data && data.length > 0) {
        return data.map((row) => ({
          timestamp: new Date(row.trading_date).toISOString(),
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: row.volume !== null ? Number(row.volume) : null,
          adjustedClose: Number(row.close),
        }));
      }
    }

    // In-memory fallback
    const candles: PriceCandle[] = [];
    for (const obs of memoryObservationStore.observations.values()) {
      if (
        obs.exchange === cleanExch &&
        obs.symbol === cleanSym &&
        obs.tradingDate >= cleanFrom &&
        obs.tradingDate <= cleanTo
      ) {
        candles.push({
          timestamp: new Date(obs.tradingDate).toISOString(),
          open: obs.open,
          high: obs.high,
          low: obs.low,
          close: obs.close,
          volume: obs.volume,
          adjustedClose: obs.close,
        });
      }
    }
    candles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return candles;
  }

  /**
   * Idempotently saves daily observations to PostgreSQL using ON CONFLICT.
   */
  async upsertDailyObservations(
    exchange: string,
    symbol: string,
    candles: PriceCandle[],
    source = 'yahoo',
    currency = 'INR',
  ): Promise<number> {
    if (candles.length === 0) return 0;
    const cleanSym = symbol.trim().toUpperCase();
    const cleanExch = exchange.trim().toUpperCase();

    // Store in memory map
    for (const c of candles) {
      const dateStr = new Date(c.timestamp).toISOString().split('T')[0]!;
      const key = `${cleanExch}:${cleanSym}:${dateStr}`;
      memoryObservationStore.observations.set(key, {
        exchange: cleanExch,
        symbol: cleanSym,
        tradingDate: dateStr,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
        currency,
        source,
        adjustmentStatus: 'split_adjusted',
        qualityFlag: 'verified',
      });
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const rows = candles.map((c) => ({
        exchange: cleanExch,
        symbol: cleanSym,
        trading_date: new Date(c.timestamp).toISOString().split('T')[0],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
        currency,
        source,
        adjustment_status: 'split_adjusted',
        quality_flag: 'verified',
        ingested_at: new Date().toISOString(),
      }));

      // In batches of 200
      const BATCH_SIZE = 200;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await supabaseRest('market_daily_observations?on_conflict=exchange,symbol,trading_date', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(batch),
        });
      }
    }

    return candles.length;
  }
}

export const observationRepository = new ObservationRepository();
