-- Phase 10: Portfolio Tracking & Investment Performance Analytics Migration

-- 1. Portfolios
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 100),
  description text check (description is null or length(description) <= 500),
  base_currency text not null default 'INR' check (base_currency in ('INR', 'USD')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolios_user_name_unique unique (user_id, name)
);

create index if not exists portfolios_user_id_idx
  on public.portfolios (user_id, created_at desc);

-- 2. Portfolio Transactions Ledger
create table if not exists public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null,
  type text not null check (type in ('BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'SPLIT')),
  symbol text,
  exchange text check (exchange is null or exchange in ('NSE', 'BSE', 'US')),
  quantity numeric not null check (quantity >= 0),
  price numeric not null check (price >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  fees numeric not null default 0 check (fees >= 0),
  taxes numeric not null default 0 check (taxes >= 0),
  total_amount numeric not null check (total_amount >= 0),
  trade_date timestamptz not null default now(),
  settlement_date timestamptz,
  notes text check (notes is null or length(notes) <= 1000),
  split_ratio numeric check (split_ratio is null or split_ratio > 0),
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_transactions_portfolio_idx
  on public.portfolio_transactions (portfolio_id, trade_date desc);

create index if not exists portfolio_transactions_user_idx
  on public.portfolio_transactions (user_id, trade_date desc);

create index if not exists portfolio_transactions_symbol_idx
  on public.portfolio_transactions (portfolio_id, symbol);

-- 3. Portfolio Snapshots (Valuation History)
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  valuation_date date not null,
  holdings_value numeric not null default 0,
  cash_balance numeric not null default 0,
  total_value numeric not null default 0,
  total_cost_basis numeric not null default 0,
  realized_pnl numeric not null default 0,
  unrealized_pnl numeric not null default 0,
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  coverage_percent numeric not null default 100 check (coverage_percent >= 0 and coverage_percent <= 100),
  created_at timestamptz not null default now(),
  constraint portfolio_snapshots_portfolio_date_unique unique (portfolio_id, valuation_date)
);

create index if not exists portfolio_snapshots_portfolio_date_idx
  on public.portfolio_snapshots (portfolio_id, valuation_date desc);

-- 4. Enable Row Level Security (RLS)
alter table public.portfolios enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.portfolio_snapshots enable row level security;

-- Policies for Portfolios
create policy "Users can view own portfolios"
  on public.portfolios for select
  using (auth.uid() = user_id);

create policy "Users can insert own portfolios"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

create policy "Users can update own portfolios"
  on public.portfolios for update
  using (auth.uid() = user_id);

create policy "Users can delete own portfolios"
  on public.portfolios for delete
  using (auth.uid() = user_id);

-- Policies for Portfolio Transactions
create policy "Users can view own transactions"
  on public.portfolio_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.portfolio_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.portfolio_transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.portfolio_transactions for delete
  using (auth.uid() = user_id);

-- Policies for Portfolio Snapshots (via portfolio ownership)
create policy "Users can view own portfolio snapshots"
  on public.portfolio_snapshots for select
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_snapshots.portfolio_id
      and portfolios.user_id = auth.uid()
    )
  );
