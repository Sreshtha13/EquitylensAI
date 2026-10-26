-- Phase 11: Advanced Stock Screener, Custom Filters & Saved Screening Strategies
-- Migration: 20261025200000_advanced_screener_saved_strategies.sql

-- 1. Saved Screening Strategies Table
create table if not exists public.saved_screens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  definition jsonb not null,
  last_run_at timestamptz,
  last_result_count integer check (last_result_count is null or last_result_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_screens_user_updated
  on public.saved_screens (user_id, updated_at desc);

-- 2. Screener Execution History / Runs Table
create table if not exists public.screener_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  saved_screen_id uuid references public.saved_screens(id) on delete set null,
  definition jsonb not null,
  result_count integer not null default 0 check (result_count >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  coverage jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}',
  executed_at timestamptz not null default now()
);

create index if not exists idx_screener_runs_user_executed
  on public.screener_runs (user_id, executed_at desc);

-- 3. Extend financial_screener_filter_matches to support new Phase 3/11 metrics
create or replace function public.financial_screener_filter_matches(
  p_metrics jsonb,
  p_filter jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_field text := p_filter ->> 'field';
  v_operator text := p_filter ->> 'operator';
  v_actual_text text;
  v_actual numeric;
  v_value numeric;
  v_upper numeric;
begin
  if v_field not in (
    'roe', 'roa', 'roce', 'gross_margin', 'operating_margin', 'net_margin',
    'debt_to_equity', 'current_ratio', 'quick_ratio', 'interest_coverage',
    'revenue_growth', 'net_income_growth', 'eps_growth', 'free_cash_flow_margin',
    'pe_ratio', 'price_to_book', 'financial_health_score'
  ) then
    return false;
  end if;

  if v_operator not in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between') then
    return false;
  end if;

  v_actual_text := p_metrics -> v_field ->> 'value';
  if v_actual_text is null or v_actual_text !~ '^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' then
    return false;
  end if;
  v_actual := v_actual_text::numeric;

  if coalesce(p_filter ->> 'value', '') !~ '^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' then
    return false;
  end if;
  v_value := (p_filter ->> 'value')::numeric;

  if v_operator = 'between' then
    if coalesce(p_filter ->> 'upperValue', '') !~ '^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' then
      return false;
    end if;
    v_upper := (p_filter ->> 'upperValue')::numeric;
    return v_actual >= v_value and v_actual <= v_upper;
  end if;

  case v_operator
    when 'eq' then return v_actual = v_value;
    when 'neq' then return v_actual <> v_value;
    when 'gt' then return v_actual > v_value;
    when 'gte' then return v_actual >= v_value;
    when 'lt' then return v_actual < v_value;
    when 'lte' then return v_actual <= v_value;
    else return false;
  end case;
end;
$$;

-- 4. Recursive filter group matcher for nested AND/OR groups
create or replace function public.financial_screener_group_matches(
  p_metrics jsonb,
  p_group jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_logic text := coalesce(p_group ->> 'logic', 'AND');
  v_conditions jsonb := p_group -> 'conditions';
  v_item jsonb;
  v_matches boolean;
  v_count integer;
begin
  if v_conditions is null or jsonb_typeof(v_conditions) <> 'array' then
    return false;
  end if;
  v_count := jsonb_array_length(v_conditions);
  if v_count = 0 then
    return true;
  end if;

  for v_item in select * from jsonb_array_elements(v_conditions) loop
    if v_item ? 'logic' or v_item ? 'conditions' then
      v_matches := public.financial_screener_group_matches(p_metrics, v_item);
    else
      v_matches := public.financial_screener_filter_matches(p_metrics, v_item);
    end if;

    if v_logic = 'AND' and not v_matches then
      return false;
    elsif v_logic = 'OR' and v_matches then
      return true;
    end if;
  end loop;

  if v_logic = 'AND' then
    return true;
  else
    return false;
  end if;
end;
$$;

-- 5. Updated screen_financial_companies function supporting nested groups and expanded metrics
create or replace function public.screen_financial_companies(
  p_filters jsonb,
  p_logic text,
  p_exchange text,
  p_period text,
  p_sort_field text,
  p_sort_direction text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
  v_total bigint;
  v_indexed bigint;
  v_stale bigint;
  v_expected integer;
  v_refresh_completed boolean;
  v_refreshed_at timestamptz;
  v_filter_group jsonb;
begin
  -- Validate filter format: can be array of filters or a group object
  if p_filters is null then
    raise exception 'Invalid screener filters';
  end if;

  if jsonb_typeof(p_filters) = 'array' then
    if jsonb_array_length(p_filters) < 1 or jsonb_array_length(p_filters) > 15 then
      raise exception 'Invalid screener filter count';
    end if;
    if p_logic is null or p_logic not in ('AND', 'OR') then
      raise exception 'Invalid screener logic';
    end if;
    v_filter_group := jsonb_build_object('logic', p_logic, 'conditions', p_filters);
  elsif jsonb_typeof(p_filters) = 'object' then
    v_filter_group := p_filters;
  else
    raise exception 'Invalid screener filter representation';
  end if;

  if p_exchange is not null and p_exchange not in ('NSE', 'BSE') then
    raise exception 'Invalid screener exchange';
  end if;
  if p_period is null or p_period not in ('annual', 'ttm') then
    raise exception 'Invalid screener period';
  end if;
  if p_sort_field is null or (
    p_sort_field <> 'symbol' and p_sort_field not in (
      'roe', 'roa', 'roce', 'gross_margin', 'operating_margin', 'net_margin',
      'debt_to_equity', 'current_ratio', 'quick_ratio', 'interest_coverage',
      'revenue_growth', 'net_income_growth', 'eps_growth', 'free_cash_flow_margin',
      'pe_ratio', 'price_to_book', 'financial_health_score'
    )
  ) then
    raise exception 'Invalid screener sort field';
  end if;
  if p_sort_direction is null or p_sort_direction not in ('asc', 'desc') then
    raise exception 'Invalid screener sort direction';
  end if;
  if p_limit is null or p_offset is null
     or p_limit < 1 or p_limit > 100 or p_offset < 0 or p_offset > 100000 then
    raise exception 'Invalid screener pagination';
  end if;

  select count(*) into v_indexed
  from public.financial_screener_metrics m
  where m.period_type = p_period
    and (p_exchange is null or m.exchange = p_exchange);

  select count(*) into v_stale
  from public.financial_screener_metrics m
  where m.period_type = p_period
    and (p_exchange is null or m.exchange = p_exchange)
    and (m.is_stale or m.retrieved_at < now() - interval '180 days');

  select coalesce(sum(coalesce(c.expected_instruments, 0)), 0),
         coalesce(bool_and(coalesce(c.refresh_completed, false)), false),
         max(c.refreshed_at)
    into v_expected, v_refresh_completed, v_refreshed_at
  from (
    select 'NSE'::text as exchange where p_exchange is null or p_exchange = 'NSE'
    union all
    select 'BSE'::text as exchange where p_exchange is null or p_exchange = 'BSE'
  ) supported
  left join public.financial_screener_coverage c on c.exchange = supported.exchange;

  with matching as materialized (
    select m.*
    from public.financial_screener_metrics m
    where m.period_type = p_period
      and (p_exchange is null or m.exchange = p_exchange)
      and public.financial_screener_group_matches(m.metrics, v_filter_group)
  ),
  counted as (
    select count(*)::bigint as total from matching
  ),
  page as (
    select m.*,
      row_number() over (order by
        case when p_sort_field = 'symbol' and p_sort_direction = 'asc' then m.symbol end asc,
        case when p_sort_field = 'symbol' and p_sort_direction = 'desc' then m.symbol end desc,
        case when p_sort_field <> 'symbol' and p_sort_direction = 'asc'
          then nullif(m.metrics -> p_sort_field ->> 'value', '')::numeric end asc nulls last,
        case when p_sort_field <> 'symbol' and p_sort_direction = 'desc'
          then nullif(m.metrics -> p_sort_field ->> 'value', '')::numeric end desc nulls last,
        m.symbol asc
      ) as page_order
    from matching m
    order by
      case when p_sort_field = 'symbol' and p_sort_direction = 'asc' then m.symbol end asc,
      case when p_sort_field = 'symbol' and p_sort_direction = 'desc' then m.symbol end desc,
      case when p_sort_field <> 'symbol' and p_sort_direction = 'asc'
        then nullif(m.metrics -> p_sort_field ->> 'value', '')::numeric end asc nulls last,
      case when p_sort_field <> 'symbol' and p_sort_direction = 'desc'
        then nullif(m.metrics -> p_sort_field ->> 'value', '')::numeric end desc nulls last,
      m.symbol asc
    limit p_limit offset p_offset
  )
  select counted.total,
    jsonb_build_object(
      'totalMatches', counted.total,
      'results', coalesce((
        select jsonb_agg(jsonb_build_object(
          'symbol', p.symbol,
          'companyName', p.company_name,
          'exchange', p.exchange,
          'currency', p.currency,
          'period', p.period_end_date,
          'periodType', p.period_type,
          'source', p.source,
          'retrievedAt', p.retrieved_at,
          'isStale', (p.is_stale or p.retrieved_at < now() - interval '180 days'),
          'metrics', p.metrics
        ) order by p.page_order)
        from page p
      ), '[]'::jsonb),
      'coverage', jsonb_build_object(
        'indexedCompanies', v_indexed,
        'staleIndexedCompanies', v_stale,
        'expectedCompanies', v_expected,
        'refreshCompleted', v_refresh_completed,
        'refreshedAt', v_refreshed_at,
        'isPartial', not v_refresh_completed or v_indexed < v_expected
      )
    )
  into v_total, v_result
  from counted;

  return v_result;
end;
$$;

-- 6. Row-Level Security Policies
alter table public.saved_screens enable row level security;
alter table public.screener_runs enable row level security;

-- Policies for saved_screens
create policy "Users can view own saved screens"
  on public.saved_screens for select
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can create own saved screens"
  on public.saved_screens for insert
  with check (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can update own saved screens"
  on public.saved_screens for update
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can delete own saved screens"
  on public.saved_screens for delete
  using (auth.uid()::text = user_id or current_user = 'service_role');

-- Policies for screener_runs
create policy "Users can view own screener runs"
  on public.screener_runs for select
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can insert own screener runs"
  on public.screener_runs for insert
  with check (auth.uid()::text = user_id or current_user = 'service_role');

-- Grants
grant select, insert, update, delete on public.saved_screens to authenticated, service_role;
grant select, insert, delete on public.screener_runs to authenticated, service_role;
grant execute on function public.financial_screener_group_matches(jsonb, jsonb) to service_role;
grant execute on function public.financial_screener_filter_matches(jsonb, jsonb) to service_role;
grant execute on function public.screen_financial_companies(jsonb, text, text, text, text, text, integer, integer) to service_role;
