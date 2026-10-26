-- Phase 9: Alerts & Notifications System Migration

-- 1. Alert Rules
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 150),
  alert_type text not null check (alert_type in ('price', 'percentage_change', 'volume', 'financial_metric', 'announcement', 'news')),
  symbol text,
  exchange text check (exchange is null or exchange in ('NSE', 'BSE', 'US')),
  rule_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  cooldown_minutes integer not null default 60 check (cooldown_minutes >= 0 and cooldown_minutes <= 43200),
  last_evaluated_at timestamptz,
  last_observation_at timestamptz,
  last_observed_value numeric,
  last_triggered_at timestamptz,
  last_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alert_rules_user_id_idx
  on public.alert_rules (user_id, created_at desc);

create index if not exists alert_rules_enabled_type_idx
  on public.alert_rules (enabled, alert_type);

create index if not exists alert_rules_symbol_exchange_idx
  on public.alert_rules (symbol, exchange);

-- 2. Alert Events
create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.alert_rules(id) on delete cascade,
  user_id uuid not null,
  alert_type text not null check (alert_type in ('price', 'percentage_change', 'volume', 'financial_metric', 'announcement', 'news')),
  symbol text,
  exchange text check (exchange is null or exchange in ('NSE', 'BSE', 'US')),
  trigger_timestamp timestamptz not null default now(),
  observed_value numeric,
  threshold_context jsonb not null default '{}'::jsonb,
  source text not null,
  deduplication_key text not null unique,
  status text not null default 'triggered' check (status in ('triggered', 'acknowledged', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists alert_events_rule_id_idx
  on public.alert_events (rule_id, trigger_timestamp desc);

create index if not exists alert_events_user_id_idx
  on public.alert_events (user_id, trigger_timestamp desc);

create index if not exists alert_events_dedup_idx
  on public.alert_events (deduplication_key);

-- 3. In-App Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  alert_event_id uuid references public.alert_events(id) on delete set null,
  category text not null check (category in ('price_alert', 'percentage_alert', 'volume_alert', 'financial_alert', 'announcement_alert', 'news_alert', 'system')),
  title text not null check (length(trim(title)) > 0),
  message text not null check (length(trim(message)) > 0),
  read boolean not null default false,
  read_at timestamptz,
  symbol text,
  exchange text check (exchange is null or exchange in ('NSE', 'BSE', 'US')),
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read, created_at desc);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- 4. Notification Deliveries
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null check (status in ('delivered', 'pending', 'failed', 'skipped')),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  last_attempt_at timestamptz not null default now(),
  provider_message_id text,
  error_message text,
  delivered_at timestamptz
);

create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries (notification_id);

-- 5. User Alert Preferences
create table if not exists public.user_alert_preferences (
  user_id uuid primary key,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  email_address text,
  price_alerts boolean not null default true,
  percentage_alerts boolean not null default true,
  volume_alerts boolean not null default true,
  financial_alerts boolean not null default true,
  announcement_alerts boolean not null default true,
  news_alerts boolean not null default true,
  digest_frequency text not null default 'realtime' check (digest_frequency in ('realtime', 'daily', 'off')),
  updated_at timestamptz not null default now()
);

-- Row Level Security (RLS)
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.user_alert_preferences enable row level security;

-- Policies for alert_rules
drop policy if exists "Users can manage own alert rules" on public.alert_rules;
create policy "Users can manage own alert rules"
  on public.alert_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for alert_events
drop policy if exists "Users can view own alert events" on public.alert_events;
create policy "Users can view own alert events"
  on public.alert_events for select
  using (auth.uid() = user_id);

-- Policies for notifications
drop policy if exists "Users can manage own notifications" on public.notifications;
create policy "Users can manage own notifications"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for notification_deliveries
drop policy if exists "Users can view own deliveries" on public.notification_deliveries;
create policy "Users can view own deliveries"
  on public.notification_deliveries for select
  using (
    exists (
      select 1 from public.notifications n
      where n.id = notification_deliveries.notification_id
        and n.user_id = auth.uid()
    )
  );

-- Policies for user_alert_preferences
drop policy if exists "Users can manage own alert preferences" on public.user_alert_preferences;
create policy "Users can manage own alert preferences"
  on public.user_alert_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
