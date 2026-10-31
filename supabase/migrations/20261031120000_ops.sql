-- EZTek Ops: leads, clients, buildings, systems, jobs and notes.
-- One database behind the website forms, the staff dashboard, the client portal and Claude (Supabase MCP).


-- People ------------------------------------------------------------------

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'dispatcher' check (role in ('admin', 'dispatcher', 'tech')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.staff is 'EZTek employees who can sign in to the dashboard. Add a row after the person signs in once.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'owner' check (kind in ('management_company', 'board', 'owner', 'business', 'homeowner', 'contractor', 'other')),
  billing_email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
comment on table public.organizations is 'Client accounts: a management company, a co-op board, a business or a homeowner.';

create table public.org_members (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'manager' check (role in ('admin', 'manager', 'super', 'billing', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
comment on table public.org_members is 'Client users who can see their organization in the portal.';

-- Buildings and systems ----------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text not null,
  address text not null,
  borough text,
  building_type text check (building_type in ('multifamily', 'condo', 'residence', 'office', 'retail', 'institution', 'other')),
  units int,
  floors int,
  plan text not null default 'none' check (plan in ('none', 'essential', 'priority', 'managed')),
  plan_since date,
  access_notes text,
  created_at timestamptz not null default now()
);
comment on table public.sites is 'Buildings. plan is the care plan for this building.';

create table public.systems (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites on delete cascade,
  service text not null, -- slug from src/data/services.ts, e.g. intercom-entry
  name text not null,
  details text,
  status text not null default 'ok' check (status in ('ok', 'warn', 'bad', 'unknown')),
  status_note text,
  installed_on date,
  warranty_until date,
  qr uuid not null default gen_random_uuid() unique, -- printed on the device sticker
  created_at timestamptz not null default now()
);
comment on table public.systems is 'Installed systems per building, with status and warranty. qr opens a service request for this system.';

-- Leads ---------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  kind text not null check (kind in ('quote', 'service', 'contact', 'partner')),
  status text not null default 'new' check (status in ('new', 'contacted', 'survey', 'proposal', 'won', 'lost', 'spam')),
  urgency text check (urgency in ('emergency', 'urgent', 'routine')),
  name text not null check (length(name) between 1 and 200),
  company text check (length(company) <= 200),
  role text check (length(role) <= 100),
  email text check (length(email) <= 200),
  phone text check (length(phone) <= 50),
  address text check (length(address) <= 300),
  borough text check (length(borough) <= 50),
  building text check (length(building) <= 100),
  systems text check (length(systems) <= 500),
  project text check (length(project) <= 100),
  timing text check (length(timing) <= 100),
  size text check (length(size) <= 200),
  care_plan text check (length(care_plan) <= 50),
  survey_window text check (length(survey_window) <= 100),
  estimate text check (length(estimate) <= 100),
  message text check (length(message) <= 5000),
  source jsonb not null default '{}' check (pg_column_size(source) <= 4000),
  assigned_to uuid references public.staff on delete set null,
  org_id uuid references public.organizations on delete set null,
  next_action_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.leads is 'Every request from the website. status moves new > contacted > survey > proposal > won/lost.';
create index leads_status_created on public.leads (status, created_at desc);

-- Jobs ----------------------------------------------------------------------

create sequence public.job_number_seq start 2300;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('EZ-' || nextval('public.job_number_seq')),
  org_id uuid references public.organizations on delete set null,
  site_id uuid references public.sites on delete set null,
  system_id uuid references public.systems on delete set null,
  lead_id uuid references public.leads on delete set null,
  kind text not null default 'service' check (kind in ('survey', 'install', 'service', 'maintenance', 'programming')),
  title text not null check (length(title) between 1 and 300),
  description text check (length(description) <= 5000),
  priority text not null default 'routine' check (priority in ('emergency', 'urgent', 'routine')),
  stage text not null default 'received' check (stage in ('received', 'scheduled', 'assigned', 'on_site', 'completed', 'cancelled')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  tech_id uuid references public.staff on delete set null,
  amount numeric(12, 2),
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
comment on table public.jobs is 'Work orders: surveys, installs, service calls, maintenance visits, programming changes. number is EZ-####.';
create index jobs_stage on public.jobs (stage, scheduled_start);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads on delete cascade,
  job_id uuid references public.jobs on delete cascade,
  author_id uuid references auth.users on delete set null default auth.uid(),
  author_name text,
  body text not null check (length(body) between 1 and 5000),
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  check ((lead_id is not null) <> (job_id is not null))
);
comment on table public.notes is 'Timeline notes on a lead or a job. client_visible notes show in the portal.';

-- Bookkeeping ---------------------------------------------------------------

create function public.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'jobs' then
    if new.stage in ('completed', 'cancelled') and old.stage not in ('completed', 'cancelled') then new.closed_at := now(); end if;
    if new.stage not in ('completed', 'cancelled') then new.closed_at := null; end if;
  end if;
  return new;
end $$;
create trigger leads_touch before update on public.leads for each row execute function public.touch();
create trigger jobs_touch before update on public.jobs for each row execute function public.touch();

-- Access rules --------------------------------------------------------------

create function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active);
$$;

create function public.my_orgs() returns setof uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

alter table public.staff enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.sites enable row level security;
alter table public.systems enable row level security;
alter table public.leads enable row level security;
alter table public.jobs enable row level security;
alter table public.notes enable row level security;

-- staff see and change everything
create policy staff_all on public.staff for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.organizations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.org_members for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.sites for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.systems for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.leads for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.jobs for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.notes for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- a staff member can read their own row (to find out they are staff)
create policy staff_self on public.staff for select to authenticated using (user_id = auth.uid());

-- clients see their own organization
create policy client_read on public.organizations for select to authenticated using (id in (select public.my_orgs()));
create policy client_read on public.org_members for select to authenticated using (org_id in (select public.my_orgs()));
create policy client_read on public.sites for select to authenticated using (org_id in (select public.my_orgs()));
create policy client_read on public.systems for select to authenticated using (site_id in (select id from public.sites where org_id in (select public.my_orgs())));
create policy client_read on public.jobs for select to authenticated using (org_id in (select public.my_orgs()));
create policy client_read on public.notes for select to authenticated using (client_visible and job_id in (select id from public.jobs where org_id in (select public.my_orgs())));
-- clients open service requests for their buildings; staff take it from 'received'
create policy client_request on public.jobs for insert to authenticated with check (
  org_id in (select public.my_orgs()) and stage = 'received' and kind = 'service' and tech_id is null and amount is null
  and (site_id is null or site_id in (select id from public.sites where org_id in (select public.my_orgs())))
);
create policy client_note on public.notes for insert to authenticated with check (
  client_visible and job_id in (select id from public.jobs where org_id in (select public.my_orgs()))
);

-- the website can only add new leads; it cannot read anything back
create policy web_insert on public.leads for insert to anon with check (
  status = 'new' and assigned_to is null and org_id is null and next_action_at is null and lost_reason is null
);
grant insert on public.leads to anon;

-- Operations shared by the dashboard and Claude ------------------------------

-- Turn a won lead into a client, a building and a first job. Returns the job id.
create function public.convert_lead(p_lead uuid, p_job_kind text default 'survey') returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  l public.leads;
  v_org uuid;
  v_site uuid;
  v_job uuid;
  v_type text;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select * into l from public.leads where id = p_lead for update;
  if l.id is null then raise exception 'lead % not found', p_lead; end if;

  v_org := l.org_id;
  if v_org is null then
    insert into public.organizations (name, kind, billing_email, phone)
    values (coalesce(nullif(l.company, ''), l.name),
            case l.role when 'Homeowner' then 'homeowner' when 'Board member' then 'board'
                        when 'Property manager' then 'management_company' when 'Managing agent' then 'management_company'
                        when 'General contractor' then 'contractor' else 'owner' end,
            l.email, l.phone)
    returning id into v_org;
  end if;

  v_type := case l.building when 'Rental apartments' then 'multifamily' when 'Condos & co-ops' then 'condo'
    when 'Private residences' then 'residence' when 'Offices & commercial' then 'office'
    when 'Retail & hospitality' then 'retail' when 'Schools & institutions' then 'institution' else 'other' end;
  if coalesce(l.address, '') <> '' then
    insert into public.sites (org_id, name, address, borough, building_type)
    values (v_org, coalesce(nullif(l.company, ''), l.address), l.address, nullif(l.borough, ''), v_type)
    returning id into v_site;
  end if;

  insert into public.jobs (org_id, site_id, lead_id, kind, title, description, priority)
  values (v_org, v_site, l.id, p_job_kind,
          case when l.kind = 'service' then left(coalesce(l.message, 'Service request'), 120)
               else initcap(p_job_kind) || ': ' || coalesce(nullif(l.systems, ''), 'site visit') end,
          concat_ws(E'\n', l.message, nullif('Systems: ' || l.systems, 'Systems: '), nullif('Size: ' || l.size, 'Size: '),
                    nullif('Survey window: ' || l.survey_window, 'Survey window: ')),
          coalesce(l.urgency, 'routine'))
  returning id into v_job;

  update public.leads set org_id = v_org, status = case when status in ('new', 'contacted') then 'survey' else status end where id = l.id;
  return v_job;
end $$;
comment on function public.convert_lead is 'Creates client, building and a first job from a lead. Used by the dashboard and by Claude.';

-- Morning summary for staff and Claude
create view public.ops_today with (security_invoker = true) as
select
  (select count(*) from public.leads where status = 'new') as new_leads,
  (select count(*) from public.leads where status = 'new' and urgency = 'emergency') as new_emergencies,
  (select count(*) from public.leads where status in ('new', 'contacted') and created_at < now() - interval '1 hour') as leads_waiting_over_1h,
  (select count(*) from public.jobs where stage not in ('completed', 'cancelled')) as open_jobs,
  (select count(*) from public.jobs where stage not in ('completed', 'cancelled') and scheduled_start::date = current_date) as jobs_today,
  (select count(*) from public.jobs where stage = 'received') as jobs_unscheduled,
  (select count(*) from public.systems where status = 'bad') as systems_down;
comment on view public.ops_today is 'One-row summary: new leads, emergencies, waiting leads, open and unscheduled jobs, systems down.';

-- Live updates in the dashboard (row level security still applies)
alter publication supabase_realtime add table public.leads, public.jobs;
