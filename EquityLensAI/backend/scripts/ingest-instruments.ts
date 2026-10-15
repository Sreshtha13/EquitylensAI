import { ingestInstruments } from '../src/market/instruments/ingestion.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  logger.info('Starting standalone instrument master ingestion...');
  try {
    const result = await ingestInstruments();
    logger.info(
      { ingestedCount: result.ingestedCount, durationMs: result.durationMs },
      'Instrument ingestion completed successfully!'
    );
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Instrument ingestion failed');
    process.exit(1);
  }
}

void main();
