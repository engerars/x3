-- x3 Supabase Realtime bootstrap (envelope mode)
-- Run in Supabase SQL Editor.

begin;

create table if not exists public.projects (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.contracts (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cpcItems (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.installments (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bonds (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cpcDetailRows (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.banks (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.appState (
  row_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.projects replica identity full;
alter table public.vendors replica identity full;
alter table public.contracts replica identity full;
alter table public.cpcItems replica identity full;
alter table public.installments replica identity full;
alter table public.bonds replica identity full;
alter table public.cpcDetailRows replica identity full;
alter table public.banks replica identity full;
alter table public.categories replica identity full;
alter table public.appState replica identity full;

alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.vendors;
alter publication supabase_realtime add table public.contracts;
alter publication supabase_realtime add table public.cpcItems;
alter publication supabase_realtime add table public.installments;
alter publication supabase_realtime add table public.bonds;
alter publication supabase_realtime add table public.cpcDetailRows;
alter publication supabase_realtime add table public.banks;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.appState;

-- WARNING:
-- The policies below allow anonymous full access for quick local deployment.
-- Lock this down before production.
alter table public.projects enable row level security;
alter table public.vendors enable row level security;
alter table public.contracts enable row level security;
alter table public.cpcItems enable row level security;
alter table public.installments enable row level security;
alter table public.bonds enable row level security;
alter table public.cpcDetailRows enable row level security;
alter table public.banks enable row level security;
alter table public.categories enable row level security;
alter table public.appState enable row level security;

drop policy if exists "anon_all_projects" on public.projects;
create policy "anon_all_projects" on public.projects for all to anon using (true) with check (true);
drop policy if exists "anon_all_vendors" on public.vendors;
create policy "anon_all_vendors" on public.vendors for all to anon using (true) with check (true);
drop policy if exists "anon_all_contracts" on public.contracts;
create policy "anon_all_contracts" on public.contracts for all to anon using (true) with check (true);
drop policy if exists "anon_all_cpcItems" on public.cpcItems;
create policy "anon_all_cpcItems" on public.cpcItems for all to anon using (true) with check (true);
drop policy if exists "anon_all_installments" on public.installments;
create policy "anon_all_installments" on public.installments for all to anon using (true) with check (true);
drop policy if exists "anon_all_bonds" on public.bonds;
create policy "anon_all_bonds" on public.bonds for all to anon using (true) with check (true);
drop policy if exists "anon_all_cpcDetailRows" on public.cpcDetailRows;
create policy "anon_all_cpcDetailRows" on public.cpcDetailRows for all to anon using (true) with check (true);
drop policy if exists "anon_all_banks" on public.banks;
create policy "anon_all_banks" on public.banks for all to anon using (true) with check (true);
drop policy if exists "anon_all_categories" on public.categories;
create policy "anon_all_categories" on public.categories for all to anon using (true) with check (true);
drop policy if exists "anon_all_appState" on public.appState;
create policy "anon_all_appState" on public.appState for all to anon using (true) with check (true);

commit;
