-- Care plan billing through Stripe, invoices for the portal, and service reports from QR stickers.

-- Billing -------------------------------------------------------------------

alter table public.organizations add column stripe_customer_id text unique;

alter table public.sites
  add column plan_status text not null default 'none' check (plan_status in ('none', 'pending', 'active', 'past_due', 'canceled')),
  add column stripe_subscription_id text unique;
comment on column public.sites.plan_status is 'Billing state of the care plan, kept in sync by the stripe-webhook function.';

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  site_id uuid references public.sites on delete set null,
  stripe_invoice_id text unique,
  number text,
  description text,
  amount_due numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  status text not null default 'open' check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_date date,
  hosted_url text, -- Stripe page where the client pays
  pdf_url text,
  created_at timestamptz not null default now()
);
comment on table public.invoices is 'Invoices mirrored from Stripe by the stripe-webhook function. Clients pay on hosted_url.';
create index invoices_org on public.invoices (org_id, created_at desc);

alter table public.invoices enable row level security;
create policy staff_all on public.invoices for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy client_read on public.invoices for select to authenticated using (org_id in (select public.my_orgs()));

-- Clients see the technician on their jobs; column grants (explicit_grants) keep the phone private
create policy client_tech on public.staff for select to authenticated using (
  user_id in (select tech_id from public.jobs where org_id in (select public.my_orgs()))
);

-- A client's service request may point at one of their own systems
drop policy client_request on public.jobs;
create policy client_request on public.jobs for insert to authenticated with check (
  org_id in (select public.my_orgs()) and stage = 'received' and kind = 'service' and tech_id is null and amount is null
  and (site_id is null or site_id in (select id from public.sites where org_id in (select public.my_orgs())))
  and (system_id is null or system_id in (select s.id from public.systems s join public.sites t on t.id = s.site_id where t.org_id in (select public.my_orgs())))
);

-- QR stickers ---------------------------------------------------------------
-- Anyone (a tenant, a super) scans the sticker and reports a problem. The lead arrives
-- linked to the system, so staff see the building and device without asking.

alter table public.leads add column system_id uuid references public.systems on delete set null;

create function public.lead_from_qr() returns trigger language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  new.system_id := null;
  -- a malformed sticker id must never cost the lead: only a well-formed uuid is looked up
  if new.source ? 'qr' and lower(new.source->>'qr') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v from public.systems where qr = lower(new.source->>'qr')::uuid;
    new.system_id := v;
  end if;
  return new;
end $$;
create trigger leads_qr before insert on public.leads for each row execute function public.lead_from_qr();

-- System and building name behind a sticker, for the report page. The building name can be its
-- street address (convert_lead uses the address when there is no company); nothing else is revealed.
create function public.qr_label(p_qr uuid) returns text language sql stable security definer set search_path = '' as $$
  select s.name || ' · ' || t.name from public.systems s join public.sites t on t.id = s.site_id where s.qr = p_qr;
$$;
grant execute on function public.qr_label(uuid) to anon, authenticated;

-- convert_lead now carries the system and its building over to the job
create or replace function public.convert_lead(p_lead uuid, p_job_kind text default 'survey') returns uuid
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

  if l.system_id is not null then
    select t.id, t.org_id into v_site, v_org from public.systems s join public.sites t on t.id = s.site_id where s.id = l.system_id;
  end if;

  v_org := coalesce(v_org, l.org_id);
  if v_org is null then
    insert into public.organizations (name, kind, billing_email, phone)
    values (coalesce(nullif(l.company, ''), l.name),
            case l.role when 'Homeowner' then 'homeowner' when 'Board member' then 'board'
                        when 'Property manager' then 'management_company' when 'Managing agent' then 'management_company'
                        when 'General contractor' then 'contractor' else 'owner' end,
            l.email, l.phone)
    returning id into v_org;
  end if;

  if v_site is null and coalesce(l.address, '') <> '' then
    v_type := case l.building when 'Rental apartments' then 'multifamily' when 'Condos & co-ops' then 'condo'
      when 'Private residences' then 'residence' when 'Offices & commercial' then 'office'
      when 'Retail & hospitality' then 'retail' when 'Schools & institutions' then 'institution' else 'other' end;
    insert into public.sites (org_id, name, address, borough, building_type)
    values (v_org, coalesce(nullif(l.company, ''), l.address), l.address, nullif(l.borough, ''), v_type)
    returning id into v_site;
  end if;

  insert into public.jobs (org_id, site_id, system_id, lead_id, kind, title, description, priority)
  values (v_org, v_site, l.system_id, l.id, p_job_kind,
          case when l.kind = 'service' then left(coalesce(l.message, 'Service request'), 120)
               else initcap(p_job_kind) || ': ' || coalesce(nullif(l.systems, ''), 'site visit') end,
          concat_ws(E'\n', l.message, nullif('Systems: ' || l.systems, 'Systems: '), nullif('Size: ' || l.size, 'Size: '),
                    nullif('Survey window: ' || l.survey_window, 'Survey window: ')),
          coalesce(l.urgency, 'routine'))
  returning id into v_job;

  update public.leads set org_id = v_org, status = case when status in ('new', 'contacted') then 'survey' else status end where id = l.id;
  return v_job;
end $$;

-- Portal summary for the signed-in client
create view public.portal_summary with (security_invoker = true) as
select
  o.id as org_id,
  o.name,
  (select count(*) from public.jobs j where j.org_id = o.id and j.stage not in ('completed', 'cancelled')) as open_requests,
  (select count(*) from public.systems s join public.sites t on t.id = s.site_id where t.org_id = o.id and s.status in ('warn', 'bad')) as needs_attention,
  (select min(j.scheduled_start) from public.jobs j where j.org_id = o.id and j.scheduled_start > now() and j.stage not in ('completed', 'cancelled')) as next_visit,
  (select coalesce(sum(i.amount_due - i.amount_paid), 0) from public.invoices i where i.org_id = o.id and i.status = 'open') as balance_due
from public.organizations o;
comment on view public.portal_summary is 'Per-organization numbers for the portal home; row level security limits it to the client''s own organizations.';

-- Client users ----------------------------------------------------------------
-- The invite-member function creates the sign-in account and the membership.

alter table public.org_members add column email text;

-- Used by invite-member (service role only) to find an existing account
create function public.user_id_by_email(p_email text) returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
