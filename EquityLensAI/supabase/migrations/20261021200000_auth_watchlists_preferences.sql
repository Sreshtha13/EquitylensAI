-- Phase 6: Authentication, User Profiles, Watchlists, Favorites & Preferences

-- 1. User Profiles
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_auth_user_id_idx
  on public.user_profiles (auth_user_id);

-- 2. Watchlists
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 100),
  description text check (description is null or length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlists_user_name_unique unique (user_id, name)
);

create index if not exists watchlists_user_id_idx
  on public.watchlists (user_id);

-- 3. Watchlist Items
create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  symbol text not null,
  exchange text not null check (exchange in ('NSE', 'BSE', 'US')),
  sort_order integer not null default 0,
  added_at timestamptz not null default now(),
  constraint watchlist_items_unique unique (watchlist_id, symbol, exchange)
);

create index if not exists watchlist_items_watchlist_id_idx
  on public.watchlist_items (watchlist_id);

-- 4. User Favorites
create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  exchange text not null check (exchange in ('NSE', 'BSE', 'US')),
  created_at timestamptz not null default now(),
  constraint user_favorites_unique unique (user_id, symbol, exchange)
);

create index if not exists user_favorites_user_id_idx
  on public.user_favorites (user_id);

-- 5. User Preferences
create table if not exists public.user_preferences (
  user_id uuid primary key,
  default_exchange text not null default 'NSE' check (default_exchange in ('NSE', 'BSE', 'US')),
  preferred_currency text not null default 'INR' check (preferred_currency in ('INR', 'USD')),
  preferred_period text not null default 'annual' check (preferred_period in ('annual', 'ttm')),
  default_landing_page text not null default '/watchlists' check (default_landing_page in ('/watchlists', '/market', '/screener', '/research', '/favorites')),
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  table_density text not null default 'comfortable' check (table_density in ('compact', 'comfortable')),
  updated_at timestamptz not null default now()
);

-- Row Level Security (RLS)
alter table public.user_profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_preferences enable row level security;

-- Policies for user_profiles
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = auth_user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = auth_user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = auth_user_id);

-- Policies for watchlists
create policy "Users can view own watchlists"
  on public.watchlists for select
  using (auth.uid() = user_id);

create policy "Users can insert own watchlists"
  on public.watchlists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own watchlists"
  on public.watchlists for update
  using (auth.uid() = user_id);

create policy "Users can delete own watchlists"
  on public.watchlists for delete
  using (auth.uid() = user_id);

-- Policies for watchlist_items
create policy "Users can view items in own watchlists"
  on public.watchlist_items for select
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "Users can insert items into own watchlists"
  on public.watchlist_items for insert
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "Users can delete items from own watchlists"
  on public.watchlist_items for delete
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

-- Policies for user_favorites
create policy "Users can view own favorites"
  on public.user_favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.user_favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.user_favorites for delete
  using (auth.uid() = user_id);

-- Policies for user_preferences
create policy "Users can view own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can upsert own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id);

-- Grant privileges to service_role and authenticated
grant select, insert, update, delete on public.user_profiles to service_role, authenticated;
grant select, insert, update, delete on public.watchlists to service_role, authenticated;
grant select, insert, update, delete on public.watchlist_items to service_role, authenticated;
grant select, insert, update, delete on public.user_favorites to service_role, authenticated;
grant select, insert, update, delete on public.user_preferences to service_role, authenticated;
