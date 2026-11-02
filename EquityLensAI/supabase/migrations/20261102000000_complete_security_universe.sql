-- Phase: Complete NSE + BSE Stock Universe Discovery & Canonical Security Master Upgrade
-- Migration: 20261102000000_complete_security_universe.sql

-- 1. Extend market_instruments with classification, exchange codes, listing status, and audit timestamps
alter table public.market_instruments
  add column if not exists classification text not null default 'MAINBOARD_EQUITY',
  add column if not exists scrip_code text,
  add column if not exists series text,
  add column if not exists listing_status text not null default 'ACTIVE',
  add column if not exists first_discovered_at timestamptz not null default now(),
  add column if not exists last_discovered_at timestamptz not null default now(),
  add column if not exists last_verified_at timestamptz not null default now(),
  add column if not exists data_completeness text not null default 'COMPLETE',
  add column if not exists historical_symbols jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Add check constraint for valid classifications if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'market_instruments_classification_check'
  ) then
    alter table public.market_instruments
      add constraint market_instruments_classification_check
      check (classification in ('MAINBOARD_EQUITY', 'SME_EQUITY', 'ETF', 'PREFERENCE_SHARE', 'REIT', 'INVIT', 'OTHER'));
  end if;
end $$;

-- Add check constraint for listing status if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'market_instruments_listing_status_check'
  ) then
    alter table public.market_instruments
      add constraint market_instruments_listing_status_check
      check (listing_status in ('ACTIVE', 'SUSPENDED', 'DELISTED'));
  end if;
end $$;

-- Add check constraint for data completeness if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'market_instruments_data_completeness_check'
  ) then
    alter table public.market_instruments
      add constraint market_instruments_data_completeness_check
      check (data_completeness in ('COMPLETE', 'PARTIAL', 'BASIC'));
  end if;
end $$;

-- 2. Indexes for fast search and cross-exchange lookups
create index if not exists idx_market_instruments_classification
  on public.market_instruments (classification, is_active);

create index if not exists idx_market_instruments_listing_status
  on public.market_instruments (listing_status);

create index if not exists idx_market_instruments_scrip_code
  on public.market_instruments (exchange, scrip_code) where scrip_code is not null;

create index if not exists idx_market_instruments_historical_symbols
  on public.market_instruments using gin (historical_symbols);

-- 3. Ingestion Runs Log Table for Auditable Sync History
create table if not exists public.universe_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('full', 'nse', 'bse', 'angel', 'reconcile')),
  status text not null check (status in ('running', 'completed', 'failed')),
  nse_count integer not null default 0,
  bse_count integer not null default 0,
  unique_securities_count integer not null default 0,
  dual_exchange_count integer not null default 0,
  mainboard_count integer not null default 0,
  sme_count integer not null default 0,
  new_securities_count integer not null default 0,
  changed_symbols_count integer not null default 0,
  unresolved_mappings_count integer not null default 0,
  duration_ms integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_universe_ingestion_runs_status
  on public.universe_ingestion_runs (started_at desc);

alter table public.universe_ingestion_runs enable row level security;

create policy "Allow public read access to universe ingestion runs"
  on public.universe_ingestion_runs for select
  using (true);

create policy "Allow service role management of universe ingestion runs"
  on public.universe_ingestion_runs for all
  using (current_user = 'service_role');
