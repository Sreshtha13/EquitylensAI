-- Phase 8: Market News, Corporate Announcements & Event Intelligence

-- 1. News Items Table
create table if not exists public.news_items (
  id text primary key,
  provider_id text not null,
  external_id text,
  title text not null check (length(trim(title)) > 0),
  canonical_url text not null,
  source_name text not null,
  source_type text not null check (source_type in ('official_exchange', 'news_publisher', 'company_ir', 'regulatory')),
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  language text default 'en',
  content_excerpt text,
  content_hash text not null unique,
  category text,
  ai_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_items_published_at_idx
  on public.news_items (published_at desc nulls last);

create index if not exists news_items_source_type_idx
  on public.news_items (source_type);

create index if not exists news_items_category_idx
  on public.news_items (category);

-- 2. Company-News Association Join Table
create table if not exists public.company_news_associations (
  id uuid primary key default gen_random_uuid(),
  news_item_id text not null references public.news_items(id) on delete cascade,
  symbol text not null,
  exchange text not null check (exchange in ('NSE', 'BSE', 'US')),
  confidence numeric not null default 1.0 check (confidence >= 0 and confidence <= 1.0),
  association_method text not null check (association_method in ('isin', 'token', 'symbol_exchange', 'symbol_exact', 'name_match')),
  created_at timestamptz not null default now(),
  constraint company_news_unique unique (news_item_id, symbol, exchange)
);

create index if not exists company_news_symbol_exchange_idx
  on public.company_news_associations (symbol, exchange);

create index if not exists company_news_item_id_idx
  on public.company_news_associations (news_item_id);

-- 3. Corporate Announcements Table
create table if not exists public.corporate_announcements (
  id text primary key,
  provider_id text not null,
  external_id text,
  symbol text not null,
  company_name text not null,
  exchange text not null check (exchange in ('NSE', 'BSE', 'US')),
  isin text,
  title text not null check (length(trim(title)) > 0),
  category text not null check (category in (
    'financial_results',
    'board_meetings',
    'dividend',
    'bonus_issue',
    'stock_split',
    'rights_issue',
    'fundraising',
    'mergers_acquisitions',
    'shareholding_pattern',
    'management_changes',
    'credit_rating',
    'governance',
    'regulatory',
    'updates',
    'general'
  )),
  description text,
  published_at timestamptz not null,
  received_at timestamptz,
  source_url text not null,
  document_url text,
  file_size text,
  content_hash text not null unique,
  retrieved_at timestamptz not null default now(),
  ai_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corporate_announcements_symbol_exchange_idx
  on public.corporate_announcements (symbol, exchange, published_at desc);

create index if not exists corporate_announcements_category_idx
  on public.corporate_announcements (category);

create index if not exists corporate_announcements_published_at_idx
  on public.corporate_announcements (published_at desc);

-- 4. Ingestion Runs & Telemetry
create table if not exists public.news_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  items_retrieved integer not null default 0 check (items_retrieved >= 0),
  items_inserted integer not null default 0 check (items_inserted >= 0),
  duplicates_count integer not null default 0 check (duplicates_count >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists news_ingestion_runs_provider_started_idx
  on public.news_ingestion_runs (provider_id, started_at desc);

-- 5. Row Level Security (RLS)
alter table public.news_items enable row level security;
alter table public.company_news_associations enable row level security;
alter table public.corporate_announcements enable row level security;
alter table public.news_ingestion_runs enable row level security;

-- Public read access for news & announcements
drop policy if exists "Allow public read access for news_items" on public.news_items;
create policy "Allow public read access for news_items"
  on public.news_items for select
  using (true);

drop policy if exists "Allow public read access for company_news_associations" on public.company_news_associations;
create policy "Allow public read access for company_news_associations"
  on public.company_news_associations for select
  using (true);

drop policy if exists "Allow public read access for corporate_announcements" on public.corporate_announcements;
create policy "Allow public read access for corporate_announcements"
  on public.corporate_announcements for select
  using (true);

drop policy if exists "Allow public read access for news_ingestion_runs" on public.news_ingestion_runs;
create policy "Allow public read access for news_ingestion_runs"
  on public.news_ingestion_runs for select
  using (true);
