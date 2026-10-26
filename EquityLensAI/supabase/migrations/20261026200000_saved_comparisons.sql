-- Phase 12: Advanced Analytics, Comparative Company Analysis & Peer Benchmarking
-- Migration: 20261026200000_saved_comparisons.sql

-- 1. Saved Comparisons Table
create table if not exists public.saved_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  symbols jsonb not null,
  metrics jsonb,
  period text not null default 'annual' check (period in ('annual', 'quarterly', 'ttm')),
  scope text not null default 'consolidated' check (scope in ('consolidated', 'standalone')),
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_comparisons_user_updated
  on public.saved_comparisons (user_id, updated_at desc);

-- 2. Row-Level Security Policies
alter table public.saved_comparisons enable row level security;

create policy "Users can view own saved comparisons"
  on public.saved_comparisons for select
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can create own saved comparisons"
  on public.saved_comparisons for insert
  with check (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can update own saved comparisons"
  on public.saved_comparisons for update
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can delete own saved comparisons"
  on public.saved_comparisons for delete
  using (auth.uid()::text = user_id or current_user = 'service_role');

-- 3. Grants
grant select, insert, update, delete on public.saved_comparisons to authenticated, service_role;
