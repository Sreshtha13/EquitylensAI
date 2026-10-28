import { angelProvider } from '../src/market/providers/angel/index.js';
import { yahooProvider } from '../src/market/providers/yahoo/index.js';
import { instrumentRepository } from '../src/market/instruments/repository.js';
import { DEFAULT_CACHE_PATH } from '../src/market/instruments/ingestion.js';
import { observationRepository } from '../src/market/observations/observationRepository.js';
import { financialService } from '../src/financial/financialService.js';
import { getEnv } from '../src/config/index.js';

async function main() {
  console.log('=== EQUITYLENSAI LIVE DATA VERIFICATION ===');
  const env = getEnv();

  // 1. Check Instrument Master
  console.log('\n--- 1. Security Master ---');
  const loaded = await instrumentRepository.loadFromDisk(DEFAULT_CACHE_PATH);
  console.log(`Loaded from disk (${DEFAULT_CACHE_PATH}): ${loaded}. Total instruments: ${instrumentRepository.count()}`);
  const rel = instrumentRepository.getBySymbol('RELIANCE', 'NSE');
  console.log('RELIANCE instrument:', rel ? `${rel.name} (token: ${rel.providerToken})` : 'NOT FOUND');

  // 2. Angel One Quote
  console.log('\n--- 2. Angel One Live Quote ---');
  console.log('Angel configured:', angelProvider.isConfigured());
  if (angelProvider.isConfigured()) {
    try {
      const q = await angelProvider.getQuote({ symbol: 'RELIANCE', exchange: 'NSE', token: rel?.providerToken });
      console.log('Angel RELIANCE quote:', {
        price: q.price,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.previousClose,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume,
        source: q.source,
        observedAt: q.observedAt,
        freshness: q.freshness,
      });
    } catch (e: unknown) {
      console.log('Angel quote error:', e instanceof Error ? e.message : String(e));
    }
  }

  // 3. Yahoo Finance Live Quote
  console.log('\n--- 3. Yahoo Finance Live Quote ---');
  try {
    const yq = await yahooProvider.getQuote({ symbol: 'RELIANCE', exchange: 'NSE' });
    console.log('Yahoo RELIANCE quote:', {
      price: yq.price,
      open: yq.open,
      high: yq.high,
      low: yq.low,
      previousClose: yq.previousClose,
      change: yq.change,
      changePercent: yq.changePercent,
      volume: yq.volume,
      source: yq.source,
      observedAt: yq.observedAt,
      freshness: yq.freshness,
    });
  } catch (e: unknown) {
    console.log('Yahoo quote error:', e instanceof Error ? e.message : String(e));
  }

  // 4. Historical Daily OHLCV
  console.log('\n--- 4. Historical Daily OHLCV ---');
  try {
    const hist = await yahooProvider.getHistoricalPrices({
      symbol: 'RELIANCE',
      exchange: 'NSE',
      interval: 'ONE_DAY',
      from: '2026-10-01',
      to: '2026-10-28',
    });
    console.log(`Retrieved ${hist.candles.length} candles for RELIANCE. Source: ${hist.source}`);
    if (hist.candles.length > 0) {
      const latest = hist.candles[hist.candles.length - 1]!;
      console.log('Latest candle:', latest);
      const count = await observationRepository.upsertDailyObservations('NSE', 'RELIANCE', [latest], 'yahoo');
      console.log('Persisted daily candle to PostgreSQL via upsertDailyObservations:', count);
      // Now read back from DB
      const readBack = await observationRepository.getDailySeries('NSE', 'RELIANCE', '2026-10-20', '2026-10-28');
      console.log(`Read back ${readBack.length} candles from PostgreSQL for RELIANCE.`);
    }
  } catch (e: unknown) {
    console.log('Historical OHLCV error:', e instanceof Error ? e.message : String(e));
  }

  // 5. Financial Statements & Analysis
  console.log('\n--- 5. Financial Statements & Analysis ---');
  try {
    const analysis = await financialService.getFinancialAnalysis({ symbol: 'RELIANCE', exchange: 'NSE' });
    console.log('RELIANCE Financial Analysis:');
    console.log('- PE Ratio:', analysis.valuation?.peRatio);
    console.log('- PB Ratio:', analysis.valuation?.priceToBook);
    console.log('- ROE (%):', analysis.profitability?.roe);
    console.log('- Net Margin (%):', analysis.profitability?.netMargin);
    console.log('- Operating Margin (%):', analysis.profitability?.operatingMargin);
    console.log('- Current Ratio:', analysis.liquidity?.currentRatio);
    console.log('- Debt to Equity:', analysis.leverage?.debtToEquity);
    console.log('- Health Score (0-100):', analysis.healthScore?.overallScore, `(${analysis.healthScore?.rating})`);
    console.log('- Primary Source:', analysis.source, 'Currency:', analysis.currency);
  } catch (e: unknown) {
    console.log('Financial Analysis error:', e instanceof Error ? e.message : String(e));
  }

  // 6. Supabase Security Master Synchronization
  console.log('\n--- 6. Supabase Security Master Sync ---');
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      console.log(`Syncing current in-memory instruments (${instrumentRepository.count()}) to Supabase market_instruments...`);
      const synced = await instrumentRepository.syncToDatabase();
      console.log(`Successfully synced ${synced} instruments to Supabase PostgreSQL.`);
    } catch (e: unknown) {
      console.log('Sync error:', e instanceof Error ? e.message : String(e));
    }
  }

  console.log('\n=== LIVE DATA VERIFICATION COMPLETE ===');
}

main().catch((err) => {
  console.error('Fatal in verification script:', err);
  process.exit(1);
});
