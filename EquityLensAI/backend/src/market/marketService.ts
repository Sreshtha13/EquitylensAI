import { AppError } from '../utils/appError.js';
import { angelProvider } from './providers/angel/index.js';
import { yahooProvider } from './providers/yahoo/index.js';
import type { MarketProvider } from './types.js';

const providers: Record<string, MarketProvider> = {
  angel: angelProvider,
  yahoo: yahooProvider,
};

export function getMarketProvider(id: string): MarketProvider {
  const provider = providers[id];

  if (!provider) {
    throw new AppError('MARKET_PROVIDER_UNKNOWN', `Unknown market provider: ${id}`, 400);
  }

  return provider;
}

export function listMarketProviders(): string[] {
  return Object.keys(providers);
}
