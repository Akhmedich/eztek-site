-- New York home improvement rules for proposals on residential buildings (General Business Law
-- § 771, Lien Law § 71-a): approximate dates, the contractor's signature, and the owner's right to
-- cancel until midnight of the third business day after signing. The /p/ page shows the required
-- notices; the deposit is taken online only once payments land in escrow (docs/home-improvement.md).

alter table public.proposals
  add column home_improvement boolean, -- null at insert: worked out from the client and the building
  add column schedule text check (length(schedule) <= 500), -- approximate start and substantial completion
  add column issued_by text, -- the EZTek person who sent it: the contractor's signature on the copy
  add column cancel_until timestamptz,
  add column cancelled_at timestamptz;

grant select (home_improvement, schedule, issued_by, cancel_until, cancelled_at) on public.proposals to authenticated;

-- End of the third business day (Monday to Friday) after the day of signing, New York time.
-- Weekends are skipped; legal holidays are not, so the window is never shorter than the law's.
create function public.cancel_deadline(p_signed timestamptz) returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  d date := (p_signed at time zone 'America/New_York')::date;
  n int := 0;
begin
  while n < 3 loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return (d + 1)::timestamp at time zone 'America/New_York';
end $$;

-- Residential work follows the home improvement rules unless staff say otherwise
create or replace function public.proposal_defaults() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status not in ('draft', 'sent') then raise exception 'A new proposal starts as a draft.'; end if;
  new.accepted_option := null; new.accepted_name := null; new.accepted_at := null; new.accepted_total := null;
  new.deposit_amount := null; new.deposit_status := 'none'; new.checkout_session_id := null;
  new.cancel_until := null; new.cancelled_at := null;
  if new.org_id is null then select org_id into new.org_id from public.jobs where id = new.job_id; end if;
  if new.home_improvement is null then
    new.home_improvement := coalesce(
      (select o.kind in ('homeowner', 'board') from public.organizations o where o.id = new.org_id), false)
      or coalesce((select s.building_type in ('residence', 'condo', 'multifamily') from public.jobs j join public.sites s on s.id = j.site_id where j.id = new.job_id), false);
  end if;
  return new;
end $$;

create or replace function public.proposal_rules() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.options, new.title, new.intro, new.deposit_pct, new.care_plan, new.job_id, new.org_id, new.token, new.home_improvement, new.schedule)
     is distinct from (old.options, old.title, old.intro, old.deposit_pct, old.care_plan, old.job_id, old.org_id, old.token, old.home_improvement, old.schedule) then
    raise exception 'A sent proposal cannot be changed. Write a new one.';
  end if;
  -- an accepted proposal changes only through the owner's cancellation (cancel_proposal)
  if old.status = 'accepted' and not (new.status = 'declined' and new.cancelled_at is not null and old.cancelled_at is null)
     and (new.status, new.accepted_option, new.accepted_name, new.accepted_at, new.accepted_total, new.deposit_amount, new.cancelled_at)
     is distinct from (old.status, old.accepted_option, old.accepted_name, old.accepted_at, old.accepted_total, old.deposit_amount, old.cancelled_at) then
    raise exception 'An accepted proposal cannot be changed.';
  end if;
  if old.status = 'draft' and new.status = 'sent' then
    if new.home_improvement and coalesce(trim(new.schedule), '') = '' then
      raise exception 'Home improvement contracts need the approximate start and completion dates before sending.';
    end if;
    if new.valid_until < public.ny_today() + 7 then new.valid_until := public.ny_today() + 30; end if;
    new.issued_by := coalesce(new.issued_by, (select name from public.staff where user_id = auth.uid()), 'EZTek Solutions');
  end if;
  return new;
end $$;

create or replace function public.proposal_by_token(p_token uuid) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.proposals;
begin
  select * into p from public.proposals where token = p_token and status <> 'draft';
  if p.id is null then return null; end if;
  if p.status in ('sent', 'viewed') and p.valid_until < public.ny_today() then
    update public.proposals set status = 'expired' where id = p.id and status = p.status;
    p.status := 'expired';
  elsif p.status = 'sent' and not public.is_staff() then
    update public.proposals set status = 'viewed', viewed_at = now() where id = p.id and status = 'sent';
    p.status := 'viewed';
  end if;
  return jsonb_build_object(
    'number', p.number, 'title', p.title, 'intro', p.intro, 'status', p.status, 'valid_until', p.valid_until,
    'care_plan', p.care_plan, 'deposit_pct', p.deposit_pct,
    'options', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', o->'key', 'name', o->'name', 'summary', o->'summary', 'recommended', coalesce(o->'recommended', 'false'::jsonb),
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('desc', l->'desc', 'qty', l->'qty', 'price', l->'price')), '[]'::jsonb)
                  from jsonb_array_elements(o->'lines') l),
        'total', public.option_total(o))), '[]'::jsonb) from jsonb_array_elements(p.options) o),
    'accepted_option', p.accepted_option, 'accepted_name', p.accepted_name, 'accepted_at', p.accepted_at,
    'accepted_total', p.accepted_total, 'deposit_amount', p.deposit_amount, 'deposit_status', p.deposit_status,
    'home_improvement', p.home_improvement, 'schedule', p.schedule, 'issued_by', p.issued_by, 'sent_at', p.sent_at,
    'cancel_until', p.cancel_until, 'cancelled_at', p.cancelled_at,
    'client', (select name from public.organizations where id = p.org_id),
    'site', (select s.name || ', ' || s.address from public.jobs j join public.sites s on s.id = j.site_id where j.id = p.job_id));
end $$;

create or replace function public.accept_proposal(p_token uuid, p_option text, p_name text) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.proposals;
  o jsonb;
  t numeric;
  v_lead uuid;
begin
  select * into p from public.proposals where token = p_token for update;
  if p.id is null or p.status not in ('sent', 'viewed') then raise exception 'This proposal cannot be accepted.'; end if;
  if p.valid_until < public.ny_today() then raise exception 'This proposal has expired. Call us for an updated one.'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 120 then raise exception 'Type your full name to sign.'; end if;
  select x into o from jsonb_array_elements(p.options) x where x->>'key' = p_option;
  if o is null then raise exception 'Pick one of the options.'; end if;
  t := public.option_total(o);
  update public.proposals set status = 'accepted', accepted_option = p_option, accepted_name = trim(p_name), accepted_at = now(),
    accepted_total = t, deposit_amount = round(t * deposit_pct / 100.0, 2),
    deposit_status = case when deposit_pct > 0 and t > 0 then 'pending' else 'none' end,
    cancel_until = case when home_improvement then public.cancel_deadline(now()) end
  where id = p.id;
  select lead_id into v_lead from public.jobs where id = p.job_id;
  if v_lead is not null then update public.leads set status = 'won' where id = v_lead and status <> 'won'; end if;
  insert into public.notes (job_id, author_name, body, client_visible)
  values (p.job_id, 'Website', format('Proposal %s accepted: %s, $%s. Signed by %s.', p.number, o->>'name', to_char(t, 'FM999,999,990.00'), trim(p_name)), true);
  return public.proposal_by_token(p_token);
end $$;

-- The owner's right to cancel a home improvement contract, from the same link, until the deadline
create function public.cancel_proposal(p_token uuid) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare p public.proposals;
begin
  select * into p from public.proposals where token = p_token for update;
  if p.id is null or p.status <> 'accepted' or not p.home_improvement or p.cancel_until is null then
    raise exception 'This contract cannot be cancelled online. Call us.';
  end if;
  if now() > p.cancel_until then raise exception 'The cancellation period has ended. Call us.'; end if;
  update public.proposals set status = 'declined', cancelled_at = now(),
    deposit_status = case when deposit_status = 'pending' then 'none' else deposit_status end
  where id = p.id;
  insert into public.notes (job_id, author_name, body, client_visible)
  values (p.job_id, 'Website', format('Contract %s cancelled by the owner within the cancellation period.', p.number), true);
  if p.deposit_status in ('processing', 'paid') then
    insert into public.notes (job_id, author_name, body, client_visible)
    values (p.job_id, 'Website', format('Refund the deposit of $%s for %s in Stripe: the owner cancelled within three business days.', to_char(p.deposit_amount, 'FM999,999,990.00'), p.number), false);
  end if;
  return public.proposal_by_token(p_token);
end $$;

grant execute on function public.cancel_proposal(uuid) to anon, authenticated;
