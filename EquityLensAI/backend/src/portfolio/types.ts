import type {
  Portfolio,
  PortfolioTransaction,
  PortfolioSnapshot,
  PortfolioTransactionType,
  SupportedCurrency,
  SupportedExchange,
} from '@equitylensai/shared';

export interface PortfolioDbRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  base_currency: SupportedCurrency;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortfolioTransactionDbRow {
  id: string;
  portfolio_id: string;
  user_id: string;
  type: PortfolioTransactionType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  quantity: string | number;
  price: string | number;
  currency: SupportedCurrency;
  fees: string | number;
  taxes: string | number;
  total_amount: string | number;
  trade_date: string;
  settlement_date: string | null;
  notes: string | null;
  split_ratio: string | number | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioSnapshotDbRow {
  id: string;
  portfolio_id: string;
  valuation_date: string;
  holdings_value: string | number;
  cash_balance: string | number;
  total_value: string | number;
  total_cost_basis: string | number;
  realized_pnl: string | number;
  unrealized_pnl: string | number;
  currency: SupportedCurrency;
  coverage_percent: string | number;
  created_at: string;
}
