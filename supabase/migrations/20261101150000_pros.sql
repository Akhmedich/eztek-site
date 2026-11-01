-- Technician and partner sign-up (pro network, phase 1). Installers apply to work for EZTek as
-- employees, or with EZTek as licensed subcontractor businesses; staff review them in /admin/.
-- New York presumes construction workers are employees (Fair Play Act), so only businesses with
-- their own licenses and insurance are taken on as partners (docs/pro-network.md).

create table public.pros (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('employee', 'partner')),
  name text not null check (length(name) between 2 and 120),
  company text check (length(company) <= 200),
  email text check (length(email) <= 200),
  phone text not null check (length(phone) between 7 and 40),
  trades text[] not null default '{}' check (cardinality(trades) <= 12 and trades <@ array['video-surveillance', 'access-control', 'alarm-systems', 'intercom-entry', 'audio-video', 'networking-cabling', 'building-automation', 'system-integration', 'maintenance-support']),
  boroughs text[] not null default '{}' check (boroughs <@ array['Brooklyn', 'Manhattan', 'Queens', 'Staten Island', 'The Bronx', 'Outside NYC']),
  years int check (years between 0 and 60),
  alarm_license text check (length(alarm_license) <= 60), -- NYS Department of State, Article 6-D
  hic_license text check (length(hic_license) <= 60), -- NYC DCWP Home Improvement Contractor
  insured boolean not null default false, -- partners: general liability and workers' comp
  about text check (length(about) <= 2000),
  status text not null default 'applied' check (status in ('applied', 'approved', 'rejected', 'paused')),
  staff_notes text check (length(staff_notes) <= 3000),
  source jsonb not null default '{}' check (pg_column_size(source) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.pros is 'Technicians and partner businesses who applied on /join/. Approved partners can later receive jobs and payouts (phase 2).';
create index pros_status on public.pros (status, created_at desc);

create trigger pros_touch before update on public.pros for each row execute function public.touch();

alter table public.pros enable row level security;
create policy staff_all on public.pros for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- the website can only add an application; it cannot read anything back
create policy web_apply on public.pros for insert to anon with check (status = 'applied' and staff_notes is null);

grant insert on public.pros to anon;
grant select, insert, update on public.pros to authenticated;
grant select, update on public.pros to service_role;
