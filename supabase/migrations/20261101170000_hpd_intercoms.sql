-- Prospects, second source: apartment buildings with open HPD violations for a broken or missing
-- intercom (NYC Open Data, HPD Housing Maintenance Code Violations). One row per building
-- (source 'nyc-hpd', source_id = HPD building id), with the owner and managing agent from the
-- building's HPD registration. Staff decide whom to reach out to; nothing is sent automatically.

alter table public.prospects
  add column violations int check (violations >= 0),
  add column agent text check (length(agent) <= 200);
comment on column public.prospects.violations is 'nyc-hpd: open intercom violations in the building when last pulled.';
comment on column public.prospects.agent is 'nyc-hpd: managing agent named on the HPD registration.';

-- A building with a broken intercom becomes a service lead; a permit stays a quote lead.
create or replace function public.prospect_to_lead(p_prospect uuid) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare x public.prospects; v uuid; hpd boolean;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select * into x from public.prospects where id = p_prospect and status in ('new', 'contacted') for update;
  if x.id is null then raise exception 'This prospect is already handled.'; end if;
  hpd := x.source = 'nyc-hpd';
  insert into public.leads (ref, kind, name, company, address, borough, building, project, systems, message, source)
  values ('PR-' || upper(left(replace(x.id::text, '-', ''), 8)),
    case when hpd then 'service' else 'quote' end,
    left(coalesce(x.owner_business, x.agent, x.applicant_business, 'Building owner'), 200), left(x.owner_business, 200),
    x.address, x.borough,
    case when hpd and x.violations > 0 then x.violations || ' open HPD intercom violations' when x.units > 0 then x.units || ' units' end,
    left(x.job_type, 100),
    case when hpd then 'intercom-entry' end,
    left(concat_ws(E'\n', case when x.agent is not null then 'Managing agent: ' || x.agent end, x.description), 5000),
    case when hpd
      then jsonb_build_object('channel', x.source, 'utm_source', x.source, 'hpd_building', x.source_id, 'issued', x.filed_on, 'violations', x.violations)
      else jsonb_build_object('channel', x.source, 'utm_source', x.source, 'permit', x.source_id, 'filed', x.filed_on, 'cost', x.cost)
    end)
  returning id into v;
  update public.prospects set status = 'lead', lead_id = v where id = x.id;
  return v;
end $$;
