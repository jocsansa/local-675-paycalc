
-- ROLES
create type public.app_role as enum ('admin','estimator','worker');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- AGREEMENTS / RATE TABLES
create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  local_union text,
  jurisdiction text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create table public.rate_tables (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  version text not null,
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create table public.rate_items (
  id uuid primary key default gen_random_uuid(),
  rate_table_id uuid not null references public.rate_tables(id) on delete cascade,
  project_type text not null,
  category text not null,
  item_code text not null,
  item_name text not null,
  material text,
  thickness text,
  height_category text,
  unit text not null,
  rate numeric(12,4) not null default 0,
  calculation_type text not null default 'per_unit',
  included_qty numeric(12,2) not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index rate_items_lookup on public.rate_items (rate_table_id, project_type, category, item_code);

create table public.rate_tiers (
  id uuid primary key default gen_random_uuid(),
  rate_item_id uuid not null references public.rate_items(id) on delete cascade,
  min_qty numeric(12,2) not null default 0,
  max_qty numeric(12,2),
  rate numeric(12,4) not null
);
create table public.rate_rules (
  id uuid primary key default gen_random_uuid(),
  rate_table_id uuid not null references public.rate_tables(id) on delete cascade,
  name text not null,
  project_type text,
  item_code text not null,
  condition jsonb not null default '{}'::jsonb,
  auto_apply boolean not null default false,
  active boolean not null default true
);

grant select on public.agreements, public.rate_tables, public.rate_items, public.rate_tiers, public.rate_rules to authenticated;
grant insert, update, delete on public.agreements, public.rate_tables, public.rate_items, public.rate_tiers, public.rate_rules to authenticated;
grant all on public.agreements, public.rate_tables, public.rate_items, public.rate_tiers, public.rate_rules to service_role;

alter table public.agreements enable row level security;
alter table public.rate_tables enable row level security;
alter table public.rate_items enable row level security;
alter table public.rate_tiers enable row level security;
alter table public.rate_rules enable row level security;

create policy "agreements_read" on public.agreements for select to authenticated using (true);
create policy "agreements_admin" on public.agreements for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "rate_tables_read" on public.rate_tables for select to authenticated using (true);
create policy "rate_tables_admin" on public.rate_tables for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "rate_items_read" on public.rate_items for select to authenticated using (true);
create policy "rate_items_admin" on public.rate_items for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "rate_tiers_read" on public.rate_tiers for select to authenticated using (true);
create policy "rate_tiers_admin" on public.rate_tiers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "rate_rules_read" on public.rate_rules for select to authenticated using (true);
create policy "rate_rules_admin" on public.rate_rules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- JOBS
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  contractor text,
  project_type text not null,
  project_subtype text,
  agreement_id uuid references public.agreements(id),
  rate_table_id uuid references public.rate_tables(id),
  job_date date not null default current_date,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.job_areas (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  floor text,
  unit text,
  room text,
  zone text,
  ceiling_height numeric(10,2),
  sort_order int not null default 0
);
create table public.job_boarding_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  area_id uuid references public.job_areas(id) on delete cascade,
  location text,
  material text not null,
  thickness text,
  height_category text,
  sheet_width numeric(10,2) not null default 4,
  sheet_height numeric(10,2) not null default 8,
  quantity numeric(12,2) not null default 0,
  sq_ft numeric(12,2) not null default 0,
  entry_mode text not null default 'sheets',
  notes text
);
create table public.job_extra_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  area_id uuid references public.job_areas(id) on delete cascade,
  item_code text not null,
  item_name text,
  quantity numeric(12,2) not null default 0,
  unit text,
  notes text
);
create table public.job_premiums (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_code text not null,
  item_name text,
  quantity numeric(12,2) not null default 1,
  notes text
);
create table public.calculation_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  base_total numeric(14,2) not null default 0,
  extras_total numeric(14,2) not null default 0,
  premiums_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  rate_table_id uuid references public.rate_tables(id),
  effective_date date,
  breakdown jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '675 PIECEWORK CALCULATION REPORT',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  unique (user_id, key)
);

grant select, insert, update, delete on public.jobs, public.job_areas, public.job_boarding_items, public.job_extra_items, public.job_premiums, public.calculation_results, public.reports, public.settings to authenticated;
grant all on public.jobs, public.job_areas, public.job_boarding_items, public.job_extra_items, public.job_premiums, public.calculation_results, public.reports, public.settings to service_role;

alter table public.jobs enable row level security;
alter table public.job_areas enable row level security;
alter table public.job_boarding_items enable row level security;
alter table public.job_extra_items enable row level security;
alter table public.job_premiums enable row level security;
alter table public.calculation_results enable row level security;
alter table public.reports enable row level security;
alter table public.settings enable row level security;

create policy "jobs_own" on public.jobs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "job_areas_own" on public.job_areas for all to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())) with check (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy "job_boarding_own" on public.job_boarding_items for all to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())) with check (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy "job_extras_own" on public.job_extra_items for all to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())) with check (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy "job_premiums_own" on public.job_premiums for all to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())) with check (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy "calc_results_own" on public.calculation_results for all to authenticated using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())) with check (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy "reports_own" on public.reports for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_own" on public.settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();
