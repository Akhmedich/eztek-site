-- Pro network, phase 2: jobs go to the nearest approved pros, pros bring helpers, clients rate the
-- work, and new demand comes in from lawful sources (marketplace lead feeds, NYC building permits).
-- Everything a pro or client does happens on a private link, without an account.

-- Pros: where they work from, how far they go, their private link and the signed partner agreement
alter table public.pros
  add column base_address text check (length(base_address) <= 300),
  add column lat double precision,
  add column lng double precision,
  add column radius_miles int not null default 25 check (radius_miles between 1 and 150),
  add column token uuid not null unique default gen_random_uuid(),
  add column agreement_name text check (length(agreement_name) <= 120),
  add column agreement_at timestamptz;

-- The website sends an application, nothing else: it cannot pick the private link or sign for anyone
revoke insert on public.pros from anon;
grant insert (kind, name, company, email, phone, trades, boroughs, years, alarm_license, hic_license, insured, about, source, base_address, lat, lng, radius_miles) on public.pros to anon;

-- Buildings get coordinates once, for routing
alter table public.sites add column lat double precision, add column lng double precision;

create function public.miles_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 3958.8 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- Offers: a job offered to a pro (the lead) or to a helper the lead pro brings in
create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs on delete cascade,
  pro_id uuid not null references public.pros on delete cascade,
  role text not null default 'lead' check (role in ('lead', 'helper')),
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'withdrawn', 'done')),
  pay numeric(12, 2) check (pay >= 0), -- what the pro is paid for this job (partners: 70% of labor, docs/pro-network.md)
  miles numeric(6, 1),
  invited_by uuid references public.pros on delete set null,
  note text check (length(note) <= 1000),
  done_note text check (length(done_note) <= 2000),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  done_at timestamptz,
  unique (job_id, pro_id)
);
comment on table public.job_offers is 'Jobs offered to pros. The first lead to accept gets the job; other lead offers are withdrawn.';
create index job_offers_pro on public.job_offers (pro_id, status);
create unique index job_offers_one_lead on public.job_offers (job_id) where role = 'lead' and status in ('accepted', 'done');

alter table public.job_offers enable row level security;
create policy staff_all on public.job_offers for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, insert, update on public.job_offers to authenticated;
grant select, update on public.job_offers to service_role;

-- Reviews: the client rates a finished job from a private link; published ones may show on the site
alter table public.jobs add column review_token uuid not null unique default gen_random_uuid();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text check (length(body) <= 2000),
  author text check (length(author) <= 80),
  publish boolean not null default false, -- the client agreed to show it on the website
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy staff_all on public.reviews for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, update on public.reviews to authenticated;

-- Staff: offer a job to the nearest approved pros who do this kind of work and cover the area.
-- Pass the building's coordinates (from the distance function) the first time; they are saved.
create function public.offer_job(p_job uuid, p_lat double precision default null, p_lng double precision default null, p_count int default 3, p_pay numeric default null)
returns table (pro_id uuid, name text, company text, miles numeric, link_token uuid) language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare j record; v_lat double precision; v_lng double precision;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select jb.id, jb.stage, jb.site_id, s.lat, s.lng, coalesce(sy.service, '') as service into j
  from public.jobs jb left join public.sites s on s.id = jb.site_id left join public.systems sy on sy.id = jb.system_id where jb.id = p_job;
  if j.id is null then raise exception 'job not found'; end if;
  if j.stage in ('completed', 'cancelled') then raise exception 'This job is closed.'; end if;
  v_lat := coalesce(j.lat, p_lat); v_lng := coalesce(j.lng, p_lng);
  if v_lat is null then raise exception 'The building has no location yet.'; end if;
  if j.lat is null and j.site_id is not null then update public.sites set lat = v_lat, lng = v_lng where id = j.site_id; end if;
  return query
  insert into public.job_offers (job_id, pro_id, miles, pay)
  select p_job, x.id, round((public.miles_between(v_lat, v_lng, x.lat, x.lng) * 1.35)::numeric, 1), p_pay
  from public.pros x
  where x.status = 'approved' and x.lat is not null and (j.service = '' or j.service = any (x.trades))
    and public.miles_between(v_lat, v_lng, x.lat, x.lng) <= x.radius_miles
    and not exists (select 1 from public.job_offers o where o.job_id = p_job and o.pro_id = x.id)
  order by public.miles_between(v_lat, v_lng, x.lat, x.lng) limit greatest(1, least(p_count, 10))
  returning job_offers.pro_id, (select x2.name from public.pros x2 where x2.id = job_offers.pro_id), (select x2.company from public.pros x2 where x2.id = job_offers.pro_id),
    job_offers.miles, (select x2.token from public.pros x2 where x2.id = job_offers.pro_id);
end $$;

-- A pro's private page: who they are and the jobs offered to them. Before they accept: the kind of
-- work, the area and distance. The title and details (written from the client's own words, which may
-- hold an address or phone), the address, access notes and crew only once they take it.
-- Offers on finished or cancelled jobs drop off.
create function public.pro_home(p_token uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p.id is null then null else jsonb_build_object(
    'name', p.name, 'company', p.company, 'kind', p.kind, 'status', p.status, 'radius_miles', p.radius_miles,
    'base_address', p.base_address, 'agreement_at', p.agreement_at,
    'rating', (select round(avg(r.rating), 1) from public.reviews r join public.job_offers o on o.job_id = r.job_id and o.status in ('accepted', 'done') where o.pro_id = p.id),
    'reviews', (select count(*) from public.reviews r join public.job_offers o on o.job_id = r.job_id and o.status in ('accepted', 'done') where o.pro_id = p.id),
    'offers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'role', o.role, 'status', o.status, 'pay', o.pay, 'miles', o.miles, 'note', o.note, 'offered_at', o.offered_at,
        'number', jb.number, 'kind', jb.kind, 'service', sy.service, 'priority', jb.priority,
        'start', jb.scheduled_start, 'end', jb.scheduled_end, 'borough', s.borough,
        'title', case when o.status in ('accepted', 'done') then jb.title end,
        'description', case when o.status in ('accepted', 'done') then jb.description end,
        'address', case when o.status in ('accepted', 'done') then s.address end,
        'access', case when o.status in ('accepted', 'done') then s.access_notes end,
        'crew', case when o.status in ('accepted', 'done') then (select jsonb_agg(jsonb_build_object('name', x.name, 'role', c.role, 'status', c.status)) from public.job_offers c join public.pros x on x.id = c.pro_id where c.job_id = o.job_id and c.id <> o.id and c.status in ('offered', 'accepted', 'done') and (c.role = 'helper' or c.status <> 'offered')) end
      ) order by o.offered_at desc) from public.job_offers o join public.jobs jb on jb.id = o.job_id left join public.sites s on s.id = jb.site_id left join public.systems sy on sy.id = jb.system_id
      where o.pro_id = p.id and o.status <> 'withdrawn' and (o.status <> 'offered' or jb.stage not in ('completed', 'cancelled'))), '[]'::jsonb)) end
  from (select null) z left join public.pros p on p.token = p_token and p.status = 'approved';
$$;

-- Partners sign the subcontract once (docs/partner-agreement.md) before taking jobs
create function public.pro_sign(p_token uuid, p_name text) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v uuid;
begin
  if length(trim(coalesce(p_name, ''))) not between 2 and 120 then raise exception 'Type your full name to sign.'; end if;
  update public.pros set agreement_name = trim(p_name), agreement_at = now() where token = p_token and status = 'approved' and agreement_at is null returning id into v;
  if v is null then raise exception 'Nothing to sign.'; end if;
  return public.pro_home(p_token);
end $$;

-- Accept or decline. The first lead to accept gets the job; the other lead offers are withdrawn.
create function public.pro_respond(p_token uuid, p_offer uuid, p_accept boolean) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.pros; o public.job_offers;
begin
  select * into p from public.pros where token = p_token and status = 'approved';
  if p.id is null then raise exception 'This link is not active.'; end if;
  if p_accept and p.kind = 'partner' and p.agreement_at is null then raise exception 'Sign the partner agreement first.'; end if;
  select * into o from public.job_offers where id = p_offer and pro_id = p.id;
  if o.id is null then raise exception 'This offer is no longer open.'; end if;
  -- one job at a time: two pros pressing Accept together are served one after the other
  perform 1 from public.jobs where id = o.job_id and stage not in ('completed', 'cancelled') for update;
  if not found then raise exception 'This job is closed.'; end if;
  select * into o from public.job_offers where id = p_offer for update;
  if o.status <> 'offered' then raise exception 'This offer is no longer open.'; end if;
  if p_accept and o.role = 'lead' and exists (select 1 from public.job_offers where job_id = o.job_id and role = 'lead' and status in ('accepted', 'done')) then
    raise exception 'Another pro took this job a moment ago.';
  end if;
  update public.job_offers set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = o.id;
  if p_accept and o.role = 'lead' then
    update public.job_offers set status = 'withdrawn' where job_id = o.job_id and role = 'lead' and status = 'offered' and id <> o.id;
    update public.jobs set stage = 'assigned' where id = o.job_id and stage in ('received', 'scheduled');
  end if;
  insert into public.notes (job_id, author_name, body) values (o.job_id, p.name, case when p_accept then format('%s accepted the job (%s).', p.name, o.role) else format('%s declined the job.', p.name) end);
  return public.pro_home(p_token);
end $$;

-- The lead pro brings in a helper from the network, nearest first; the helper gets the job on their own link
create function public.pro_helpers(p_token uuid, p_offer uuid) returns table (pro_id uuid, name text, company text, miles numeric) language sql stable security definer set search_path = '' as $$
  select x.id, x.name, x.company, round((public.miles_between(s.lat, s.lng, x.lat, x.lng) * 1.35)::numeric, 1)
  from public.pros p
  join public.job_offers o on o.id = p_offer and o.pro_id = p.id and o.role = 'lead' and o.status = 'accepted'
  join public.jobs jb on jb.id = o.job_id join public.sites s on s.id = jb.site_id
  join public.pros x on x.status = 'approved' and x.id <> p.id and x.lat is not null
  where p.token = p_token and s.lat is not null
    and not exists (select 1 from public.job_offers c where c.job_id = o.job_id and c.pro_id = x.id and c.status in ('offered', 'accepted', 'done'))
  order by public.miles_between(s.lat, s.lng, x.lat, x.lng) limit 8;
$$;

create function public.pro_invite(p_token uuid, p_offer uuid, p_helper uuid, p_note text default null) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.pros; o public.job_offers;
begin
  select * into p from public.pros where token = p_token and status = 'approved';
  select * into o from public.job_offers where id = p_offer and pro_id = p.id and role = 'lead' and status = 'accepted';
  if o.id is null then raise exception 'Only the pro who took the job can bring in helpers.'; end if;
  if not exists (select 1 from public.pro_helpers(p_token, p_offer) h where h.pro_id = p_helper) then raise exception 'Pick a pro from the list.'; end if;
  -- a pro who passed on the job earlier (or lost the race for it) can still come in as a helper
  insert into public.job_offers (job_id, pro_id, role, invited_by, note) values (o.job_id, p_helper, 'helper', p.id, left(nullif(trim(p_note), ''), 1000))
  on conflict (job_id, pro_id) do update set role = 'helper', status = 'offered', invited_by = excluded.invited_by, note = excluded.note, offered_at = now(), responded_at = null;
  insert into public.notes (job_id, author_name, body) values (o.job_id, p.name, format('%s asked %s to help.', p.name, (select name from public.pros where id = p_helper)));
  return public.pro_home(p_token);
end $$;

-- The lead pro reports the job done; staff sign it off and ask the client for a review
create function public.pro_done(p_token uuid, p_offer uuid, p_note text) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.pros; o public.job_offers;
begin
  select * into p from public.pros where token = p_token and status = 'approved';
  select * into o from public.job_offers where id = p_offer and pro_id = p.id and status = 'accepted' for update;
  if o.id is null then raise exception 'This job is not open on your list.'; end if;
  update public.job_offers set status = 'done', done_at = now(), done_note = left(nullif(trim(p_note), ''), 2000) where id = o.id;
  insert into public.notes (job_id, author_name, body) values (o.job_id, p.name, format('%s reported the work done%s', p.name, coalesce(': ' || nullif(trim(p_note), ''), '.')));
  return public.pro_home(p_token);
end $$;

-- What the client's review link shows
create function public.review_info(p_token uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('number', jb.number, 'title', jb.title, 'stage', jb.stage,
    'pros', (select jsonb_agg(x.name) from public.job_offers o join public.pros x on x.id = o.pro_id where o.job_id = jb.id and o.status in ('accepted', 'done')),
    'review', (select jsonb_build_object('rating', r.rating, 'body', r.body) from public.reviews r where r.job_id = jb.id))
  from public.jobs jb where jb.review_token = p_token;
$$;

create function public.submit_review(p_token uuid, p_rating int, p_body text, p_author text, p_publish boolean) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_job uuid;
begin
  select id into v_job from public.jobs where review_token = p_token and stage = 'completed';
  if v_job is null then raise exception 'Reviews open once the job is completed.'; end if;
  if p_rating not between 1 and 5 then raise exception 'Pick 1 to 5 stars.'; end if;
  insert into public.reviews (job_id, rating, body, author, publish)
  values (v_job, p_rating, left(nullif(trim(p_body), ''), 2000), left(nullif(trim(p_author), ''), 80), coalesce(p_publish, false))
  on conflict (job_id) do update set rating = excluded.rating, body = excluded.body, author = excluded.author, publish = excluded.publish;
  insert into public.notes (job_id, author_name, body) values (v_job, 'Website', format('Client review: %s/5%s', p_rating, coalesce(' "' || left(nullif(trim(p_body), ''), 200) || '"', '')));
  return public.review_info(p_token);
end $$;

-- Published reviews for the website: first name and initial only
create function public.public_reviews() returns table (rating int, body text, author text, created_at timestamptz) language sql stable security definer set search_path = '' as $$
  select r.rating, r.body, coalesce(r.author, 'EZTek client'), r.created_at from public.reviews r where r.publish and r.body is not null order by r.created_at desc limit 12;
$$;

-- Prospects: buildings with fresh permits for new construction or large alterations (NYC Open Data),
-- for staff to reach out to the owner's business; never contacted automatically.
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'nyc-dob',
  source_id text not null,
  filed_on date,
  job_type text,
  address text,
  borough text,
  lat double precision,
  lng double precision,
  owner_business text,
  applicant_business text,
  cost numeric(14, 2),
  units int,
  description text,
  status text not null default 'new' check (status in ('new', 'contacted', 'lead', 'skip')),
  lead_id uuid references public.leads on delete set null,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);
create index prospects_status on public.prospects (status, filed_on desc);
alter table public.prospects enable row level security;
create policy staff_all on public.prospects for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, update on public.prospects to authenticated;
grant select, insert, update on public.prospects to service_role;

-- Marketplace leads (intake function): one lead per channel and the channel's own id
create unique index leads_external on public.leads ((source->>'channel'), (source->>'external_id')) where source ? 'external_id';

-- Staff: turn a prospect into a lead in one step, so the usual funnel takes over
create function public.prospect_to_lead(p_prospect uuid) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare x public.prospects; v uuid;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select * into x from public.prospects where id = p_prospect and status in ('new', 'contacted') for update;
  if x.id is null then raise exception 'This prospect is already handled.'; end if;
  insert into public.leads (ref, kind, name, company, address, borough, building, project, message, source)
  values ('PR-' || upper(left(replace(x.id::text, '-', ''), 8)), 'quote', coalesce(x.owner_business, x.applicant_business, 'Building owner'), x.owner_business,
    x.address, x.borough, case when x.units > 0 then x.units || ' units' end, left(x.job_type, 100), left(x.description, 5000),
    jsonb_build_object('channel', x.source, 'utm_source', x.source, 'permit', x.source_id, 'filed', x.filed_on, 'cost', x.cost))
  returning id into v;
  update public.prospects set status = 'lead', lead_id = v where id = x.id;
  return v;
end $$;

grant execute on function public.prospect_to_lead(uuid) to authenticated;
grant execute on function public.pro_home(uuid), public.pro_sign(uuid, text), public.pro_respond(uuid, uuid, boolean), public.pro_helpers(uuid, uuid),
  public.pro_invite(uuid, uuid, uuid, text), public.pro_done(uuid, uuid, text), public.review_info(uuid),
  public.submit_review(uuid, int, text, text, boolean), public.public_reviews() to anon, authenticated;
grant execute on function public.offer_job(uuid, double precision, double precision, int, numeric) to authenticated;
