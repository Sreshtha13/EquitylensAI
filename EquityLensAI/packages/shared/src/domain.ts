export const ASSET_TYPES = ['equity', 'etf', 'index', 'crypto', 'commodity', 'forex'] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const MARKETS = [
  'nse',
  'bse',
  'us',
  'jp',
  'uk',
  'hk',
  'crypto',
  'commodity',
  'forex',
] as const;

export type Market = (typeof MARKETS)[number];

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
};
