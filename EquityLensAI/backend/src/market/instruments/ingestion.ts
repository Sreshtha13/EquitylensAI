import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstrumentRecord } from '../types.js';
import { instrumentRepository } from './repository.js';
import { SEED_INSTRUMENTS } from './seedData.js';
import {
  nseDiscoveryProvider,
  type DiscoveredNSERecord,
  type SymbolChangeRecord,
  type NameChangeRecord,
} from './nseDiscoveryProvider.js';
import { bseDiscoveryProvider, type DiscoveredBSERecord } from './bseDiscoveryProvider.js';
import {
  angelDiscoveryProvider,
  type AngelScrip,
  ANGEL_SCRIP_MASTER_URL,
} from './angelDiscoveryProvider.js';
import { reconciliationService, type ReconciliationStats } from './reconciliationService.js';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_PATH = path.resolve(__dirname, '../../../data/instruments-cache.json');

export { ANGEL_SCRIP_MASTER_URL };
export type { AngelScrip };

/**
 * Backwards-compatible export of Angel One normalizer.
 */
export function normalizeAngelScrips(scrips: AngelScrip[]): InstrumentRecord[] {
  return [...SEED_INSTRUMENTS, ...angelDiscoveryProvider.normalizeAngelScrips(scrips)];
}

export type IngestionMode = 'full' | 'nse' | 'bse' | 'angel' | 'reconcile';

export interface SourceTelemetry {
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
  discoveredCount: number;
  lastAttemptAt?: string;
  error?: string;
}

export interface IngestionStatus {
  isIngesting: boolean;
  lastIngestedAt: string | null;
  totalInstruments: number;
  nseDiscoveredCount: number;
  bseDiscoveredCount: number;
  uniqueSecurityCount: number;
  nseOnlyCount: number;
  bseOnlyCount: number;
  dualExchangeCount: number;
  mainboardCount: number;
  smeCount: number;
  newSecuritiesCount: number;
  changedSymbolsCount: number;
  unresolvedMappingsCount: number;
  failedDownloads: string[];
  lastSuccessfulSync: string | null;
  currentJobStatus: 'idle' | 'running' | 'completed' | 'failed';
  sources: {
    nse: SourceTelemetry;
    bse: SourceTelemetry;
    angel: SourceTelemetry;
  };
  lastError: string | null;
}

let isIngesting = false;
let lastIngestedAt: string | null = null;
let lastSuccessfulSync: string | null = null;
let lastError: string | null = null;
let currentJobStatus: 'idle' | 'running' | 'completed' | 'failed' = 'idle';
let failedDownloads: string[] = [];

let latestStats: ReconciliationStats = {
  nseDiscoveredCount: 0,
  bseDiscoveredCount: 0,
  angelDiscoveredCount: 0,
  totalCanonicalInstruments: 0,
  uniqueSecurityCount: 0,
  dualExchangeCount: 0,
  nseOnlyCount: 0,
  bseOnlyCount: 0,
  mainboardCount: 0,
  smeCount: 0,
  etfCount: 0,
  newSecuritiesCount: 0,
  changedSymbolsCount: 0,
  unresolvedMappingsCount: 0,
  reconciledAt: '',
};

const sourceTelemetry: IngestionStatus['sources'] = {
  nse: { status: 'idle', discoveredCount: 0 },
  bse: { status: 'idle', discoveredCount: 0 },
  angel: { status: 'idle', discoveredCount: 0 },
};

export function getIngestionStatus(): IngestionStatus {
  return {
    isIngesting,
    lastIngestedAt,
    totalInstruments: instrumentRepository.count(),
    nseDiscoveredCount: latestStats.nseDiscoveredCount,
    bseDiscoveredCount: latestStats.bseDiscoveredCount,
    uniqueSecurityCount: latestStats.uniqueSecurityCount || instrumentRepository.count(),
    nseOnlyCount: latestStats.nseOnlyCount,
    bseOnlyCount: latestStats.bseOnlyCount,
    dualExchangeCount: latestStats.dualExchangeCount,
    mainboardCount: latestStats.mainboardCount,
    smeCount: latestStats.smeCount,
    newSecuritiesCount: latestStats.newSecuritiesCount,
    changedSymbolsCount: latestStats.changedSymbolsCount,
    unresolvedMappingsCount: latestStats.unresolvedMappingsCount,
    failedDownloads: [...failedDownloads],
    lastSuccessfulSync,
    currentJobStatus,
    sources: { ...sourceTelemetry },
    lastError,
  };
}

export interface IngestOptions {
  mode?: IngestionMode;
  cachePath?: string;
  forceDbSync?: boolean;
}

export interface IngestionResult {
  ingestedCount: number;
  durationMs: number;
  stats: ReconciliationStats;
  mode: IngestionMode;
}

/**
 * Main ingestion workflow executing multi-source official discovery,
 * canonical reconciliation, database upsert, and atomic cache rebuild.
 */
export async function ingestInstruments(
  optionsOrPath: string | IngestOptions = DEFAULT_CACHE_PATH,
): Promise<IngestionResult> {
  if (isIngesting) {
    throw new Error('Instrument ingestion is already in progress');
  }

  const options: IngestOptions =
    typeof optionsOrPath === 'string'
      ? { cachePath: optionsOrPath, mode: 'full' }
      : { cachePath: DEFAULT_CACHE_PATH, mode: 'full', ...optionsOrPath };

  const mode = options.mode || 'full';
  const cachePath = options.cachePath || DEFAULT_CACHE_PATH;
  const startTime = Date.now();

  isIngesting = true;
  currentJobStatus = 'running';
  lastError = null;
  failedDownloads = [];

  logger.info({ mode, cachePath }, 'Starting security universe ingestion pipeline');

  try {
    let nseRecords: DiscoveredNSERecord[] = [];
    let bseRecords: DiscoveredBSERecord[] = [];
    let angelRecords: InstrumentRecord[] = [];
    let symbolChanges: SymbolChangeRecord[] = [];
    let nameChanges: NameChangeRecord[] = [];

    // 1. Official NSE Discovery
    if (mode === 'full' || mode === 'nse') {
      sourceTelemetry.nse.status = 'running';
      sourceTelemetry.nse.lastAttemptAt = new Date().toISOString();
      try {
        const nseResult = await nseDiscoveryProvider.discoverNSE();
        nseRecords = nseResult.records;
        symbolChanges = nseResult.symbolChanges;
        nameChanges = nseResult.nameChanges;
        sourceTelemetry.nse.status = 'success';
        sourceTelemetry.nse.discoveredCount = nseRecords.length;
        if (nseResult.errors.length > 0) {
          failedDownloads.push(...nseResult.errors);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceTelemetry.nse.status = 'failed';
        sourceTelemetry.nse.error = msg;
        failedDownloads.push(`NSE discovery error: ${msg}`);
        logger.error({ err }, 'NSE discovery failed; continuing with remaining providers');
      }
    } else {
      sourceTelemetry.nse.status = 'skipped';
    }

    // 2. Official BSE Discovery
    if (mode === 'full' || mode === 'bse') {
      sourceTelemetry.bse.status = 'running';
      sourceTelemetry.bse.lastAttemptAt = new Date().toISOString();
      try {
        const bseResult = await bseDiscoveryProvider.discoverBSE({ includeInactive: true });
        bseRecords = bseResult.records;
        sourceTelemetry.bse.status = 'success';
        sourceTelemetry.bse.discoveredCount = bseRecords.length;
        if (bseResult.errors.length > 0) {
          failedDownloads.push(...bseResult.errors);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceTelemetry.bse.status = 'failed';
        sourceTelemetry.bse.error = msg;
        failedDownloads.push(`BSE discovery error: ${msg}`);
        logger.error({ err }, 'BSE discovery failed; continuing with remaining providers');
      }
    } else {
      sourceTelemetry.bse.status = 'skipped';
    }

    // 3. Supplementary Angel One Master
    if (mode === 'full' || mode === 'angel') {
      sourceTelemetry.angel.status = 'running';
      sourceTelemetry.angel.lastAttemptAt = new Date().toISOString();
      try {
        const angelResult = await angelDiscoveryProvider.discoverAngel();
        angelRecords = angelResult.records;
        sourceTelemetry.angel.status = 'success';
        sourceTelemetry.angel.discoveredCount = angelRecords.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceTelemetry.angel.status = 'failed';
        sourceTelemetry.angel.error = msg;
        failedDownloads.push(`Angel One master error: ${msg}`);
        logger.warn({ err }, 'Angel One scrip master download failed; continuing');
      }
    } else {
      sourceTelemetry.angel.status = 'skipped';
    }

    // Existing repository records to ensure zero loss
    const existingRecords = instrumentRepository.list();

    // 4. Canonical Reconciliation Engine
    logger.info(
      {
        nseCount: nseRecords.length,
        bseCount: bseRecords.length,
        angelCount: angelRecords.length,
        existingCount: existingRecords.length,
      },
      'Reconciling security universe',
    );

    const reconciled = reconciliationService.reconcile({
      nseRecords,
      bseRecords,
      angelRecords,
      symbolChanges,
      nameChanges,
      existingRecords,
    });

    latestStats = reconciled.stats;

    // 5. Atomic Update of In-Memory Repository
    instrumentRepository.load(reconciled.instruments);

    // 6. Atomic Save to Disk Cache
    await instrumentRepository.saveToDisk(cachePath);

    // 7. Synchronize to Canonical Supabase PostgreSQL Database
    try {
      await instrumentRepository.syncToDatabase();
    } catch (dbErr) {
      logger.warn({ dbErr }, 'Non-fatal: could not synchronize instruments to PostgreSQL');
    }

    const durationMs = Date.now() - startTime;
    lastIngestedAt = new Date().toISOString();
    lastSuccessfulSync = lastIngestedAt;
    currentJobStatus = 'completed';

    logger.info(
      {
        total: instrumentRepository.count(),
        durationMs,
        unique: latestStats.uniqueSecurityCount,
        dual: latestStats.dualExchangeCount,
      },
      'Security universe ingestion completed successfully',
    );

    return {
      ingestedCount: instrumentRepository.count(),
      durationMs,
      stats: latestStats,
      mode,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastError = msg;
    currentJobStatus = 'failed';
    logger.error({ err }, 'Instrument universe ingestion encountered critical error');
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
    logger.info(
      { count: instrumentRepository.count() },
      'Successfully initialized instrument universe from PostgreSQL database',
    );
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
