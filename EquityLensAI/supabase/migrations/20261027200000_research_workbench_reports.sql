-- Phase 13: Research Workbench, Investment Reports & Exportable Analysis
-- Migration: 20261027200000_research_workbench_reports.sql

-- 1. Research Projects Table
create table if not exists public.research_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null check (char_length(trim(title)) between 1 and 150),
  description text check (description is null or char_length(description) <= 1000),
  symbol text not null check (char_length(trim(symbol)) between 1 and 30),
  exchange text not null default 'NSE',
  company_name text not null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'ready_for_review', 'finalized', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_research_projects_user_updated
  on public.research_projects (user_id, updated_at desc);

create index if not exists idx_research_projects_symbol
  on public.research_projects (symbol, exchange);

-- 2. Research Reports Table
create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  research_project_id uuid not null references public.research_projects(id) on delete cascade,
  user_id text not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  template_id text not null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'ready_for_review', 'finalized', 'archived')),
  schema_version integer not null default 1,
  version integer not null default 1,
  sections jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  generated_at timestamptz,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_research_reports_project_updated
  on public.research_reports (research_project_id, updated_at desc);

create index if not exists idx_research_reports_user_updated
  on public.research_reports (user_id, updated_at desc);

-- 3. Research Report Versions Table
create table if not exists public.research_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.research_reports(id) on delete cascade,
  version_number integer not null,
  content_snapshot jsonb not null,
  summary_notes text,
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint research_report_version_unique unique (report_id, version_number)
);

create index if not exists idx_research_report_versions_report_version
  on public.research_report_versions (report_id, version_number desc);

-- 4. Research Notes Table
create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  research_project_id uuid not null references public.research_projects(id) on delete cascade,
  report_id uuid references public.research_reports(id) on delete set null,
  section_id text,
  user_id text not null,
  tag text not null default 'observation' check (tag in ('observation', 'assumption', 'question', 'risk')),
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_research_notes_project_created
  on public.research_notes (research_project_id, created_at desc);

create index if not exists idx_research_notes_user_project
  on public.research_notes (user_id, research_project_id);

-- 5. Row-Level Security Policies
alter table public.research_projects enable row level security;
alter table public.research_reports enable row level security;
alter table public.research_report_versions enable row level security;
alter table public.research_notes enable row level security;

-- Projects Policies
create policy "Users can view own research projects"
  on public.research_projects for select
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can create own research projects"
  on public.research_projects for insert
  with check (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can update own research projects"
  on public.research_projects for update
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can delete own research projects"
  on public.research_projects for delete
  using (auth.uid()::text = user_id or current_user = 'service_role');

-- Reports Policies
create policy "Users can view own research reports"
  on public.research_reports for select
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can create own research reports"
  on public.research_reports for insert
  with check (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can update own research reports"
  on public.research_reports for update
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can delete own research reports"
  on public.research_reports for delete
  using (auth.uid()::text = user_id or current_user = 'service_role');

-- Versions Policies
create policy "Users can view report versions"
  on public.research_report_versions for select
  using (
    exists (
      select 1 from public.research_reports r
      where r.id = research_report_versions.report_id
      and (auth.uid()::text = r.user_id or current_user = 'service_role')
    )
  );

create policy "Users can create report versions"
  on public.research_report_versions for insert
  with check (
    exists (
      select 1 from public.research_reports r
      where r.id = research_report_versions.report_id
      and (auth.uid()::text = r.user_id or current_user = 'service_role')
    )
  );

-- Notes Policies
create policy "Users can view own research notes"
  on public.research_notes for select
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can create own research notes"
  on public.research_notes for insert
  with check (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can update own research notes"
  on public.research_notes for update
  using (auth.uid()::text = user_id or current_user = 'service_role');

create policy "Users can delete own research notes"
  on public.research_notes for delete
  using (auth.uid()::text = user_id or current_user = 'service_role');

-- 6. Grants
grant select, insert, update, delete on public.research_projects to authenticated, service_role;
grant select, insert, update, delete on public.research_reports to authenticated, service_role;
grant select, insert, update, delete on public.research_report_versions to authenticated, service_role;
grant select, insert, update, delete on public.research_notes to authenticated, service_role;
