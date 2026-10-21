import { financialService } from '../src/financial/financialService.js';
import { initializeInstruments } from '../src/market/instruments/ingestion.js';
import { instrumentRepository } from '../src/market/instruments/repository.js';
import type { InstrumentRecord } from '../src/market/types.js';
import { buildScreenerRows } from '../src/ai/screener/screenerData.js';
import {
  updateScreenerCoverage,
  upsertScreenerMetrics,
  type ScreenerMetricRow,
} from '../src/ai/screener/screenerRepository.js';
import { logger } from '../src/utils/logger.js';

const BATCH_SIZE = 20;
const CONCURRENCY = 2;

function getOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

function selectInstruments(
  instruments: InstrumentRecord[],
  exchange: string | undefined,
  limit: number | undefined,
): InstrumentRecord[] {
  const selected = instruments.filter(
    (instrument) =>
      instrument.assetType === 'equity' &&
      (instrument.exchange === 'NSE' || instrument.exchange === 'BSE') &&
      (!exchange || instrument.exchange === exchange),
  );
  return limit ? selected.slice(0, limit) : selected;
}

async function main() {
  const requestedExchange = getOption('exchange')?.toUpperCase();
  if (requestedExchange && requestedExchange !== 'NSE' && requestedExchange !== 'BSE') {
    throw new Error('Use --exchange=NSE or --exchange=BSE.');
  }
  const requestedLimit = getOption('limit');
  const limit = requestedLimit === undefined ? undefined : Number(requestedLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }

  const hasCachedUniverse = await initializeInstruments();
  if (!hasCachedUniverse) {
    throw new Error('Run the instrument-master ingestion before screening financials.');
  }
  const exchanges = requestedExchange ? [requestedExchange] : ['NSE', 'BSE'];
  let failureCount = 0;
  let processedCount = 0;
  const exchangesWithoutUniverse: string[] = [];
  const failedSymbols: string[] = [];

  for (const exchange of exchanges) {
    const universe = instrumentRepository.list({
      exchange,
      assetType: 'equity',
    });
    const instruments = selectInstruments(universe, exchange, limit);
    let exchangeFailureCount = 0;
    await updateScreenerCoverage({
      exchange: exchange as 'NSE' | 'BSE',
      expectedInstruments: universe.length,
      refreshCompleted: false,
    });
    if (universe.length === 0) {
      exchangesWithoutUniverse.push(exchange);
      logger.error({ exchange }, 'financial_screener_instrument_universe_missing');
      continue;
    }
    logger.info(
      { exchange, selectedCount: instruments.length, expectedCount: universe.length },
      'Starting financial screener ingestion',
    );

    for (let start = 0; start < instruments.length; start += BATCH_SIZE) {
      const batch = instruments.slice(start, start + BATCH_SIZE);
      const processed = await mapConcurrent(batch, CONCURRENCY, async (instrument) => {
        try {
          const analysis = await financialService.getFinancialAnalysis({
            symbol: instrument.symbol,
            exchange,
            annualPeriods: 4,
          });
          return {
            symbol: instrument.symbol,
            rows: buildScreenerRows(analysis, {
              symbol: instrument.symbol,
              name: instrument.name,
              exchange: exchange as 'NSE' | 'BSE',
              currency: instrument.currency,
            }),
          };
        } catch (error) {
          failureCount += 1;
          exchangeFailureCount += 1;
          failedSymbols.push(`${exchange}:${instrument.symbol}`);
          logger.warn(
            {
              symbol: instrument.symbol,
              exchange,
              errorName: error instanceof Error ? error.name : 'UnknownError',
              errorMessage: error instanceof Error ? error.message : String(error),
              ...(typeof error === 'object' && error !== null && 'code' in error
                ? { errorCode: String(error.code) }
                : {}),
              ...(typeof error === 'object' && error !== null && 'statusCode' in error
                ? { statusCode: Number(error.statusCode) }
                : {}),
            },
            'financial_screener_instrument_ingestion_failed',
          );
          return null;
        }
      });

      const successful = processed.filter(
        (item): item is { symbol: string; rows: ScreenerMetricRow[] } => item !== null,
      );
      await upsertScreenerMetrics(successful.flatMap((item) => item.rows));
      processedCount += successful.length;
      logger.info(
        { exchange, processedCount, batchCount: batch.length, failures: failureCount },
        'Financial screener ingestion progress',
      );
    }

    const exchangeProcessed = instruments.length;
    const completed =
      universe.length > 0 && exchangeFailureCount === 0 && exchangeProcessed === universe.length;
    await updateScreenerCoverage({
      exchange: exchange as 'NSE' | 'BSE',
      expectedInstruments: universe.length,
      refreshCompleted: completed,
    });
  }

  logger.info(
    {
      processedCount,
      failureCount,
      failedSymbols: failedSymbols.slice(0, 50),
      failedSymbolsTruncated: failedSymbols.length > 50,
      exchangesWithoutUniverse,
    },
    'Financial screener ingestion finished',
  );
  if (failureCount > 0 || exchangesWithoutUniverse.length > 0) {
    const missingUniverseMessage =
      exchangesWithoutUniverse.length > 0
        ? `No instrument universe was found for ${exchangesWithoutUniverse.join(', ')}. `
        : '';
    throw new Error(
      `${failureCount} company financial record(s) failed. ${missingUniverseMessage}Coverage is marked incomplete.`,
    );
  }
}

main().catch((error: unknown) => {
  logger.error(
    {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    },
    'Financial screener ingestion failed',
  );
  process.exitCode = 1;
});
