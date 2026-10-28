-- Phase 15: Canonical Security Master, Historical Observations & Calculation Reproducibility
-- Migration: 20261028200000_canonical_instruments_and_history.sql

-- 1. Canonical Security / Instrument Master Table
create table if not exists public.market_instruments (
  id uuid primary key default gen_random_uuid(),
  exchange text not null check (exchange in ('NSE', 'BSE', 'NASDAQ', 'NYSE')),
  symbol text not null check (char_length(trim(symbol)) between 1 and 30),
  name text not null,
  isin text check (isin is null or char_length(isin) = 12),
  sector text,
  industry text,
  asset_type text not null default 'equity' check (asset_type in ('equity', 'index', 'etf')),
  currency text not null default 'INR',
  provider_token text,
  tick_size numeric(10, 4) not null default 0.05 check (tick_size > 0),
  lot_size integer not null default 1 check (lot_size >= 1),
  is_active boolean not null default true,
  source text not null default 'angel_scrip_master',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_instruments_exchange_symbol_unique unique (exchange, symbol)
);

create index if not exists idx_market_instruments_lookup
  on public.market_instruments (exchange, symbol, is_active);

create index if not exists idx_market_instruments_isin
  on public.market_instruments (isin) where isin is not null;

create index if not exists idx_market_instruments_sector_industry
  on public.market_instruments (sector, industry);

-- 2. Canonical Market Daily Observations (Historical OHLCV)
create table if not exists public.market_daily_observations (
  id uuid primary key default gen_random_uuid(),
  exchange text not null check (exchange in ('NSE', 'BSE', 'NASDAQ', 'NYSE')),
  symbol text not null check (char_length(trim(symbol)) between 1 and 30),
  trading_date date not null,
  open numeric(14, 4) not null check (open > 0),
  high numeric(14, 4) not null check (high >= open and high >= low and high >= close),
  low numeric(14, 4) not null check (low > 0 and low <= open and low <= high and low <= close),
  close numeric(14, 4) not null check (close > 0),
  volume bigint not null default 0 check (volume >= 0),
  currency text not null default 'INR',
  source text not null default 'yahoo',
  adjustment_status text not null default 'unadjusted' check (adjustment_status in ('unadjusted', 'split_adjusted', 'fully_adjusted')),
  quality_flag text not null default 'verified' check (quality_flag in ('verified', 'suspect', 'reconciled')),
  ingested_at timestamptz not null default now(),
  constraint market_daily_observations_unique unique (exchange, symbol, trading_date)
);

create index if not exists idx_market_daily_obs_series
  on public.market_daily_observations (exchange, symbol, trading_date desc);

-- 3. Calculation Versions Table
create table if not exists public.calculation_versions (
  version_id text primary key check (char_length(trim(version_id)) between 1 and 30),
  name text not null,
  description text not null,
  formulas jsonb not null default '{}'::jsonb,
  null_handling_rules jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed Initial Calculation Version v1.0.0
insert into public.calculation_versions (version_id, name, description, formulas, null_handling_rules, is_active)
values (
  '1.0.0',
  'EquityLensAI Core Deterministic Financial Ratio Engine v1.0.0',
  'Standard institutional valuation, profitability, leverage, liquidity, growth, and Piotroski/Altman hybrid health score calculation rules.',
  '{
    "pe_ratio": "price / ttm_eps (null if eps <= 0 or price is null)",
    "price_to_book": "price / book_value_per_share (null if bvps <= 0)",
    "roe": "net_income / stockholders_equity * 100 (null if equity <= 0)",
    "roa": "net_income / total_assets * 100 (null if assets <= 0)",
    "roce": "ebit / capital_employed * 100 (null if capital_employed <= 0)",
    "net_margin": "net_income / total_revenue * 100 (null if revenue <= 0)",
    "operating_margin": "operating_income / total_revenue * 100 (null if revenue <= 0)",
    "debt_to_equity": "total_debt / stockholders_equity (null if equity <= 0)",
    "current_ratio": "current_assets / current_liabilities (null if liabilities <= 0)",
    "quick_ratio": "(current_assets - inventory) / current_liabilities (null if liabilities <= 0)",
    "interest_coverage": "ebit / interest_expense (null if interest_expense <= 0)",
    "financial_health_score": "composite 0-100 score across profitability, leverage, liquidity, efficiency"
  }'::jsonb,
  '{
    "negative_denominators": "return null, never treat as positive or zero",
    "zero_denominators": "return null, never divide by zero",
    "missing_financial_statement_inputs": "propagate null, never fabricate zero"
  }'::jsonb,
  true
)
on conflict (version_id) do nothing;

-- 4. Extend screener_runs with Reproducibility Metadata
alter table public.screener_runs
  add column if not exists calculation_version text not null default '1.0.0',
  add column if not exists universe_version text not null default 'current',
  add column if not exists result_snapshot jsonb,
  add column if not exists normalized_criteria jsonb;

-- 5. Row-Level Security
alter table public.market_instruments enable row level security;
alter table public.market_daily_observations enable row level security;
alter table public.calculation_versions enable row level security;

-- Public read access for market master and observations
create policy "Allow public read access to market instruments"
  on public.market_instruments for select
  using (true);

create policy "Allow service role management of market instruments"
  on public.market_instruments for all
  using (current_user = 'service_role');

create policy "Allow public read access to market daily observations"
  on public.market_daily_observations for select
  using (true);

create policy "Allow service role management of market daily observations"
  on public.market_daily_observations for all
  using (current_user = 'service_role');

create policy "Allow public read access to calculation versions"
  on public.calculation_versions for select
  using (true);

create policy "Allow service role management of calculation versions"
  on public.calculation_versions for all
  using (current_user = 'service_role');
