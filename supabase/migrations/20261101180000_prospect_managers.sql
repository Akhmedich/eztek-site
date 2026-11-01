-- Prospects > Intercom violations, grouped by managing agent: how many buildings and violations each
-- manager has, by borough, so staff talk to one manager about the whole portfolio. One portfolio
-- lead per manager covers all of their buildings. Staff only.

-- Same manager, different spellings: "WAVECREST MGMT GROUP", "Knickerbocker c/o Wavecrest Management Group"
create function public.agent_key(p text) returns text language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(
    trim(regexp_replace(regexp_replace(regexp_replace(upper(coalesce(p, '')), '^.*C/O\s*', ''), '\mMGMT\M', 'MANAGEMENT', 'g'), '[^A-Z0-9 ]', '', 'g')),
    '(\s+(GROUP|CORP|CORPORATION|INC|LLC|CO|COMPANY))+$', ''), '')
$$;

create index prospects_agent on public.prospects (public.agent_key(agent)) where source = 'nyc-hpd';

-- One row per manager for the chosen status ('open' = new and contacted) and borough (null = all)
create function public.prospect_managers(p_status text default 'open', p_borough text default null)
returns table (manager text, name text, buildings int, violations int, latest date, boroughs jsonb, items jsonb)
language sql stable security invoker set search_path = '' as $$
  with b as (
    select p.*, public.agent_key(p.agent) as k from public.prospects p
    where public.is_staff() and p.source = 'nyc-hpd' and p.agent is not null
      and (case when coalesce(p_status, 'open') = 'open' then p.status in ('new', 'contacted') else p.status = p_status end)
      and (p_borough is null or p.borough ilike p_borough)
  )
  select k, mode() within group (order by agent), count(*)::int, coalesce(sum(b.violations), 0)::int, max(filed_on),
    (select jsonb_object_agg(bo, n) from (select coalesce(x.borough, '?') as bo, count(*) as n from b x where x.k = b.k group by 1) t),
    jsonb_agg(jsonb_build_object('id', id, 'address', address, 'borough', borough, 'violations', b.violations, 'filed_on', filed_on, 'owner', owner_business, 'status', status)
      order by b.violations desc nulls last, filed_on desc)
  from b where k is not null
  group by k
  order by count(*) desc, sum(b.violations) desc nulls last
  limit 300
$$;
revoke execute on function public.prospect_managers(text, text) from public, anon;
grant execute on function public.prospect_managers(text, text) to authenticated;

-- One service lead for all open buildings of a manager (in one borough, or all); the buildings
-- become 'lead' and point to it
create function public.prospects_to_portfolio_lead(p_manager text, p_borough text default null) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v uuid; pids uuid[]; n int; viol int; who text; bos text[]; ids text[]; first_addr text; lines text;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select array_agg(id) into pids from (
    select id from public.prospects
    where source = 'nyc-hpd' and status in ('new', 'contacted') and public.agent_key(agent) = p_manager
      and (p_borough is null or borough ilike p_borough)
    for update) s;
  select count(*), coalesce(sum(violations), 0), mode() within group (order by agent), array_agg(distinct borough), (array_agg(source_id order by violations desc nulls last))[1:100],
      (array_agg(address order by violations desc nulls last))[1],
      string_agg(concat_ws(', ', address, borough, coalesce(violations, 0) || ' open', case when owner_business is not null then 'owner ' || owner_business end), E'\n' order by violations desc nulls last)
    into n, viol, who, bos, ids, first_addr, lines from public.prospects where id = any(pids);
  if n = 0 then raise exception 'No open buildings for this manager.'; end if;
  insert into public.leads (ref, kind, name, company, address, borough, building, project, systems, message, source)
  values ('PF-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8)), 'service', left(who, 200), left(who, 200),
    case when n = 1 then first_addr end, case when cardinality(bos) = 1 then bos[1] end,
    left(n || ' buildings, ' || viol || ' open HPD intercom violations', 100), 'HPD intercom violations: portfolio', 'intercom-entry',
    left('Managing agent: ' || who || E'\nBuildings with open HPD intercom violations:\n' || lines, 5000),
    jsonb_build_object('channel', 'nyc-hpd', 'utm_source', 'nyc-hpd', 'manager', p_manager, 'hpd_buildings', to_jsonb(ids), 'buildings', n, 'violations', viol))
  returning id into v;
  update public.prospects set status = 'lead', lead_id = v where id = any(pids);
  return v;
end $$;
revoke execute on function public.prospects_to_portfolio_lead(text, text) from public, anon;
grant execute on function public.prospects_to_portfolio_lead(text, text) to authenticated;
