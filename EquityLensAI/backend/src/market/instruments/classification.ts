import type { SecurityClassification, ListingStatus, AssetType } from '../types.js';

export const DEFAULT_ELIGIBLE_CLASSIFICATIONS: readonly SecurityClassification[] = [
  'MAINBOARD_EQUITY',
  'SME_EQUITY',
] as const;

/**
 * Classifies an NSE security based on series, symbol, and instrument characteristics.
 * NSE official series documentation:
 * - EQ: Ordinary Equity Shares (Rolling Settlement, Normal Trading)
 * - BE: Book Entry / Trade-for-Trade Ordinary Equity
 * - BZ: Scrips traded in Trade-for-Trade for non-compliance (Ordinary Equity)
 * - SM / ST: NSE Emerge SME Platform Equity
 * - GB / ETF / E$: Exchange Traded Funds
 * - P1 / PREF: Preference shares
 * - RR / IV: Real Estate / Infrastructure Investment Trusts
 */
export function classifyNSESecurity(series: string, symbol: string, name: string): {
  classification: SecurityClassification;
  assetType: AssetType;
} {
  const normSeries = (series || '').trim().toUpperCase();
  const normSym = (symbol || '').trim().toUpperCase();
  const normName = (name || '').trim().toUpperCase();

  // SME Equity Platform (NSE Emerge)
  if (normSeries === 'SM' || normSeries === 'ST') {
    return { classification: 'SME_EQUITY', assetType: 'equity' };
  }

  // ETFs
  if (
    normSeries === 'GB' ||
    normSeries === 'E$' ||
    normSym.endsWith('BEES') ||
    normSym.endsWith('ETF') ||
    normName.includes('ETF') ||
    normName.includes('EXCHANGE TRADED FUND')
  ) {
    return { classification: 'ETF', assetType: 'etf' };
  }

  // Preference shares
  if (
    normSeries.startsWith('P') ||
    normSym.includes('PREF') ||
    normName.includes('PREFERENCE SHARE') ||
    normName.includes('PREF')
  ) {
    return { classification: 'PREFERENCE_SHARE', assetType: 'equity' };
  }

  // REITs & InvITs
  if (normSeries === 'RR' || normName.includes('REIT') || normName.includes('REAL ESTATE')) {
    return { classification: 'REIT', assetType: 'equity' };
  }
  if (normSeries === 'IV' || normName.includes('INVIT') || normName.includes('INFRASTRUCTURE')) {
    return { classification: 'INVIT', assetType: 'equity' };
  }

  // Mainboard Equity (EQ, BE, BZ, E1, IL, etc.)
  if (
    normSeries === 'EQ' ||
    normSeries === 'BE' ||
    normSeries === 'BZ' ||
    normSeries === 'E1' ||
    normSeries === 'IL' ||
    normSeries === 'IT' ||
    normSeries === ''
  ) {
    return { classification: 'MAINBOARD_EQUITY', assetType: 'equity' };
  }

  return { classification: 'OTHER', assetType: 'equity' };
}

/**
 * Classifies a BSE security based on BSE group, segment, and issuer name.
 * BSE official group documentation:
 * - Group A: High-liquidity, large-cap / established mainboard equities
 * - Group B: Mid and small-cap mainboard equities (rolling settlement)
 * - Group T: Trade-for-trade settlement mainboard equities
 * - Group X / XT: Equities with lower market capitalization
 * - Group Z: Non-compliant mainboard equities
 * - Group M / MT: BSE SME Platform equities
 * - Group E / IF: ETFs & Index Funds
 * - Group P / R: Preference shares / rights
 */
export function classifyBSESecurity(group: string, segment: string, name: string): {
  classification: SecurityClassification;
  assetType: AssetType;
} {
  const normGroup = (group || '').trim().toUpperCase();
  const normSegment = (segment || '').trim().toLowerCase();
  const normName = (name || '').trim().toUpperCase();

  // BSE SME Platform
  if (normGroup === 'M' || normGroup === 'MT' || normSegment === 'sme') {
    return { classification: 'SME_EQUITY', assetType: 'equity' };
  }

  // ETFs
  if (
    normGroup === 'E' ||
    normGroup === 'IF' ||
    normSegment === 'etf' ||
    normName.includes('ETF') ||
    normName.includes('EXCHANGE TRADED FUND')
  ) {
    return { classification: 'ETF', assetType: 'etf' };
  }

  // Preference shares
  if (
    normGroup === 'P' ||
    normGroup === 'R' ||
    normName.includes('PREFERENCE SHARE') ||
    normName.includes('PREF')
  ) {
    return { classification: 'PREFERENCE_SHARE', assetType: 'equity' };
  }

  // REITs & InvITs
  if (normName.includes('REIT')) {
    return { classification: 'REIT', assetType: 'equity' };
  }
  if (normName.includes('INVIT')) {
    return { classification: 'INVIT', assetType: 'equity' };
  }

  // Mainboard Equity groups
  if (['A', 'B', 'T', 'X', 'XT', 'Z', 'MS', 'I', ''].includes(normGroup)) {
    return { classification: 'MAINBOARD_EQUITY', assetType: 'equity' };
  }

  return { classification: 'OTHER', assetType: 'equity' };
}

export interface EligibilityFilterOptions {
  allowedClassifications?: SecurityClassification[];
  includeInactive?: boolean;
}

/**
 * Validates whether an instrument is eligible for standard stock directory inclusion.
 * By default includes MAINBOARD_EQUITY and SME_EQUITY, and excludes DELISTED securities.
 */
export function isEligibleStock(
  record: {
    classification?: SecurityClassification;
    assetType?: AssetType;
    listingStatus?: ListingStatus;
  },
  options?: EligibilityFilterOptions,
): boolean {
  if (record.assetType === 'index') return true;

  // Listing status check
  if (!options?.includeInactive && record.listingStatus === 'DELISTED') {
    return false;
  }

  const allowed = options?.allowedClassifications ?? DEFAULT_ELIGIBLE_CLASSIFICATIONS;
  const classification = record.classification ?? 'MAINBOARD_EQUITY';

  return allowed.includes(classification);
}
