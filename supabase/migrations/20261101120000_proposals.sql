-- Proposals: the line-item offer sent after a survey. The client opens a secret link (no account),
-- picks an option, signs with their name and pays the deposit on Stripe. Staff write proposals in
-- /admin/ (or Claude drafts them); the lead turns "won" when the client accepts.
-- Dates are New York dates: a proposal valid until Nov 5 can be accepted all of Nov 5 Eastern time.

create sequence public.proposal_number_seq start 1001;

create function public.ny_today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/New_York')::date;
$$;

-- Options: [{ "key": "a", "name": "Recommended", "summary": "...", "recommended": true,
--             "lines": [{ "desc": "...", "qty": 2, "price": 450 }] }]
create function public.proposal_options_ok(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and not exists (
    select 1 from jsonb_array_elements(p) o
    where jsonb_typeof(o->'key') is distinct from 'string' or jsonb_typeof(o->'name') is distinct from 'string'
       or jsonb_typeof(o->'lines') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(o->'lines') l
                  where jsonb_typeof(l->'desc') is distinct from 'string' or jsonb_typeof(l->'qty') is distinct from 'number'
                     or jsonb_typeof(l->'price') is distinct from 'number'));
$$;

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('P-' || nextval('public.proposal_number_seq')),
  job_id uuid not null references public.jobs on delete cascade,
  org_id uuid references public.organizations on delete set null,
  title text not null check (length(title) between 1 and 200),
  intro text check (length(intro) <= 3000),
  options jsonb not null default '[]' check (public.proposal_options_ok(options) and pg_column_size(options) <= 60000),
  care_plan text check (care_plan in ('essential', 'priority', 'managed')),
  deposit_pct int not null default 50 check (deposit_pct between 0 and 100),
  valid_until date not null default (public.ny_today() + 30),
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  token uuid not null unique default gen_random_uuid(), -- the client's link: staff read it through proposal_tokens()
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_option text,
  accepted_name text,
  accepted_at timestamptz,
  accepted_total numeric(12, 2),
  deposit_amount numeric(12, 2),
  -- pending: due; processing: a bank payment is on its way (1-4 business days); paid
  deposit_status text not null default 'none' check (deposit_status in ('none', 'pending', 'processing', 'paid')),
  checkout_session_id text, -- the open Stripe Checkout for the deposit, reused so a client cannot pay twice
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.proposals is 'Offers sent after a survey. The client accepts one option on /p/?t=<token> and pays the deposit. Sent proposals cannot be edited; write a new one.';
create index proposals_job on public.proposals (job_id, created_at desc);

create trigger proposals_touch before update on public.proposals for each row execute function public.touch();

-- New proposals start as drafts (or sent) with nothing accepted; the client is the job's client
create function public.proposal_defaults() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status not in ('draft', 'sent') then raise exception 'A new proposal starts as a draft.'; end if;
  new.accepted_option := null; new.accepted_name := null; new.accepted_at := null; new.accepted_total := null;
  new.deposit_amount := null; new.deposit_status := 'none'; new.checkout_session_id := null;
  if new.org_id is null then select org_id into new.org_id from public.jobs where id = new.job_id; end if;
  return new;
end $$;
create trigger proposals_defaults before insert on public.proposals for each row execute function public.proposal_defaults();

-- What the client saw is what they sign: once sent, the offer itself cannot change (write a new one).
-- Once accepted, the acceptance cannot change either; only the deposit moves (Stripe or staff).
-- Sending a draft whose date is close or past gives it a fresh 30 days.
create function public.proposal_rules() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.options, new.title, new.intro, new.deposit_pct, new.care_plan, new.job_id, new.org_id, new.token)
     is distinct from (old.options, old.title, old.intro, old.deposit_pct, old.care_plan, old.job_id, old.org_id, old.token) then
    raise exception 'A sent proposal cannot be changed. Write a new one.';
  end if;
  if old.status = 'accepted' and (new.status, new.accepted_option, new.accepted_name, new.accepted_at, new.accepted_total, new.deposit_amount)
     is distinct from (old.status, old.accepted_option, old.accepted_name, old.accepted_at, old.accepted_total, old.deposit_amount) then
    raise exception 'An accepted proposal cannot be changed.';
  end if;
  if old.status = 'draft' and new.status = 'sent' and new.valid_until < public.ny_today() + 7 then
    new.valid_until := public.ny_today() + 30;
  end if;
  return new;
end $$;
create trigger proposals_rules before update on public.proposals for each row execute function public.proposal_rules();

alter table public.proposals enable row level security;
create policy staff_all on public.proposals for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy client_read on public.proposals for select to authenticated using (status <> 'draft' and org_id in (select public.my_orgs()));

-- Signed-in users read every column except the token; staff get links through proposal_tokens()
grant select (id, number, job_id, org_id, title, intro, options, care_plan, deposit_pct, valid_until, status, sent_at, viewed_at,
  accepted_option, accepted_name, accepted_at, accepted_total, deposit_amount, deposit_status, created_by, created_at, updated_at)
  on public.proposals to authenticated;
grant insert, update on public.proposals to authenticated;
grant select, update on public.proposals to service_role;
grant usage on sequence public.proposal_number_seq to authenticated;

create function public.proposal_tokens(p_job uuid) returns table (id uuid, token uuid) language sql stable security definer set search_path = '' as $$
  select id, token from public.proposals where job_id = p_job and public.is_staff();
$$;

-- Sum of an option's lines (qty x price), rounded to cents
create function public.option_total(p_option jsonb) returns numeric language sql immutable set search_path = '' as $$
  select coalesce(sum(round((l->>'qty')::numeric * (l->>'price')::numeric, 2)), 0)
  from jsonb_array_elements(coalesce(p_option->'lines', '[]'::jsonb)) l;
$$;

-- What the client's link shows: only the offer's own fields. A client's first open marks it viewed,
-- and a sent proposal past its date turns expired. Staff opening the link change nothing.
create function public.proposal_by_token(p_token uuid) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
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
    'client', (select name from public.organizations where id = p.org_id),
    'site', (select s.name || ', ' || s.address from public.jobs j join public.sites s on s.id = j.site_id where j.id = p.job_id));
end $$;

-- The client accepts one option and signs with their name. Sets the deposit due, marks the lead won
-- and leaves a note on the job that the client can see in the portal.
create function public.accept_proposal(p_token uuid, p_option text, p_name text) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
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
    deposit_status = case when deposit_pct > 0 and t > 0 then 'pending' else 'none' end
  where id = p.id;
  select lead_id into v_lead from public.jobs where id = p.job_id;
  if v_lead is not null then update public.leads set status = 'won' where id = v_lead and status <> 'won'; end if;
  insert into public.notes (job_id, author_name, body, client_visible)
  values (p.job_id, 'Website', format('Proposal %s accepted: %s, $%s. Signed by %s.', p.number, o->>'name', to_char(t, 'FM999,999,990.00'), trim(p_name)), true);
  return public.proposal_by_token(p_token);
end $$;

grant execute on function public.proposal_by_token(uuid), public.accept_proposal(uuid, text, text) to anon, authenticated;
grant execute on function public.proposal_tokens(uuid) to authenticated;
