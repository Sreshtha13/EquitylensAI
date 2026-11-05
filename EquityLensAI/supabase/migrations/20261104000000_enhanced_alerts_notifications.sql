-- Complete Alerts & Notifications System Enhancement Migration

-- 1. Alert Rules Enhancement
alter table if exists public.alert_rules
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists trigger_type text not null default 'recurring',
  add column if not exists expires_at timestamptz,
  add column if not exists delivery_channels jsonb not null default '["in_app"]'::jsonb;

-- Update constraints on alert_rules
alter table if exists public.alert_rules
  drop constraint if exists alert_rules_status_check;
alter table if exists public.alert_rules
  add constraint alert_rules_status_check check (status in ('ACTIVE', 'PAUSED', 'TRIGGERED', 'EXPIRED', 'RESOLVED'));

alter table if exists public.alert_rules
  drop constraint if exists alert_rules_trigger_type_check;
alter table if exists public.alert_rules
  add constraint alert_rules_trigger_type_check check (trigger_type in ('one_time', 'recurring'));

alter table if exists public.alert_rules
  drop constraint if exists alert_rules_alert_type_check;
alter table if exists public.alert_rules
  add constraint alert_rules_alert_type_check check (
    alert_type in (
      'price',
      'percentage_change',
      'volume',
      'unusual_volume',
      'rsi',
      'macd',
      'moving_average',
      '52w_high_low',
      'circuit',
      'announcement',
      'corporate_action',
      'financial_results',
      'financial_metric',
      'index_movement',
      'watchlist_event',
      'news'
    )
  );

create index if not exists alert_rules_status_idx
  on public.alert_rules (user_id, status);

create index if not exists alert_rules_expires_at_idx
  on public.alert_rules (expires_at)
  where expires_at is not null;

-- 2. Alert Events Constraint Update
alter table if exists public.alert_events
  drop constraint if exists alert_events_alert_type_check;
alter table if exists public.alert_events
  add constraint alert_events_alert_type_check check (
    alert_type in (
      'price',
      'percentage_change',
      'volume',
      'unusual_volume',
      'rsi',
      'macd',
      'moving_average',
      '52w_high_low',
      'circuit',
      'announcement',
      'corporate_action',
      'financial_results',
      'financial_metric',
      'index_movement',
      'watchlist_event',
      'news'
    )
  );

-- 3. Notifications Enhancement
alter table if exists public.notifications
  add column if not exists archived boolean not null default false,
  add column if not exists link text;

alter table if exists public.notifications
  drop constraint if exists notifications_category_check;
alter table if exists public.notifications
  add constraint notifications_category_check check (
    category in (
      'price_alert',
      'percentage_alert',
      'volume_alert',
      'technical_alert',
      'financial_alert',
      'announcement_alert',
      'corporate_action_alert',
      'market_event',
      'research_report',
      'screener_result',
      'system',
      'news_alert'
    )
  );

create index if not exists notifications_user_archived_idx
  on public.notifications (user_id, archived, read, created_at desc);

-- 4. Notification Deliveries Channel Update
alter table if exists public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;
alter table if exists public.notification_deliveries
  add constraint notification_deliveries_channel_check check (
    channel in ('in_app', 'email', 'push')
  );

-- 5. User Alert Preferences Enhancement
alter table if exists public.user_alert_preferences
  add column if not exists push_enabled boolean not null default false,
  add column if not exists technical_alerts boolean not null default true,
  add column if not exists market_summaries boolean not null default true,
  add column if not exists research_updates boolean not null default true,
  add column if not exists system_alerts boolean not null default true,
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start text,
  add column if not exists quiet_hours_end text,
  add column if not exists timezone text not null default 'Asia/Kolkata';

alter table if exists public.user_alert_preferences
  drop constraint if exists user_alert_preferences_digest_frequency_check;
alter table if exists public.user_alert_preferences
  add constraint user_alert_preferences_digest_frequency_check check (
    digest_frequency in ('realtime', 'daily', 'weekly', 'off')
  );

-- 6. Browser Push Subscriptions Table
create table if not exists public.browser_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists browser_push_subscriptions_user_idx
  on public.browser_push_subscriptions (user_id);

alter table public.browser_push_subscriptions enable row level security;

drop policy if exists "Users can manage own push subscriptions" on public.browser_push_subscriptions;
create policy "Users can manage own push subscriptions"
  on public.browser_push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
