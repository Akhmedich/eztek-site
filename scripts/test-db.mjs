// Runs the Supabase migrations in an in-memory Postgres (PGlite) with stand-ins for the
// parts of Supabase they use (auth.users, auth.uid(), anon/authenticated roles, the
// realtime publication), then checks the access rules and convert_lead().
// npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../supabase/migrations/', import.meta.url);
const db = new PGlite();
let failed = 0;
const ok = (cond, name) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failed++; };
const rejects = async (p, name) => { try { await p; ok(false, name); } catch { ok(true, name); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  -- Storage as Supabase ships it: RLS on, the API roles may insert and select, policies decide
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid, created_at timestamptz default now());
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert on storage.objects to anon, authenticated;
  -- The project runs with "Automatically expose new tables" off: every data grant comes from the
  -- migrations. Supabase still hands the API roles these on new tables; a migration revokes them.
  alter default privileges in schema public grant truncate, trigger, references on tables to anon, authenticated, service_role;
`);
process.on('unhandledRejection', (e) => { console.error('ERROR', e.message, e.where || ''); process.exit(1); });
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
ok(true, 'migrations apply');
const STAFF = '00000000-0000-0000-0000-00000000000a';
const CLIENT = '00000000-0000-0000-0000-00000000000c';
const OTHER = '00000000-0000-0000-0000-00000000000d';
await db.exec(`
  insert into auth.users values ('${STAFF}', 'mansur@eztek.us'), ('${CLIENT}', 'dana@example.com'), ('${OTHER}', 'x@example.com');
  insert into public.staff (user_id, name, role) values ('${STAFF}', 'Mansur', 'admin');
`);
const as = async (role, uid = '') => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]); if (role) await db.exec(`set role ${role}`); };
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

// website visitor
await as('anon');
await db.query(`insert into public.leads (ref, kind, urgency, name, phone, address, borough, building, systems, size, message, source)
  values ('Q-1031-1111', 'quote', null, 'Dana Kim', '7185550100', '100 Shore Rd, Brooklyn', 'Brooklyn', 'Rental apartments', 'Intercom, Cameras', 'units: 48', 'Old buzzer', '{"utm_source":"google"}')`);
ok(true, 'anon can add a lead');
await rejects(db.query('select * from public.leads'), 'anon cannot read leads back');
await rejects(db.query(`insert into public.leads (ref, kind, name, status) values ('Q-x', 'quote', 'Bot', 'won')`), 'anon cannot set lead status');
await rejects(db.query(`insert into public.jobs (title) values ('x')`), 'anon cannot create jobs');
await rejects(db.query(`select public.convert_lead(gen_random_uuid())`), 'anon cannot convert leads');
await rejects(db.query(`select public.user_id_by_email('mansur@eztek.us')`), 'anon cannot look up accounts by email');
await rejects(db.query(`select * from public.organizations`), 'anon has no access to client data');
await rejects(db.query(`insert into public.leads (ref, kind, name) values ('Q-y', 'quote', repeat('a', 300))`), 'over-long name is rejected');
await rejects(db.query('truncate public.leads'), 'anon cannot truncate tables');
await rejects(db.query('select public.is_staff()'), 'anon cannot call staff helpers');
await as('');
await db.exec('create table public.made_later (id int)');
await as('anon');
await rejects(db.query('truncate public.made_later'), 'tables made later do not hand anon TRUNCATE either');

// staff
await as('authenticated', STAFF);
const lead = await one(`select * from public.leads where ref = 'Q-1031-1111'`);
ok(!!lead && lead.status === 'new', 'staff sees the new lead');
ok((await one('select new_leads from public.ops_today')).new_leads === 1, 'ops_today counts it');
const jobId = (await one(`select public.convert_lead($1, 'survey') as id`, [lead.id])).id;
const job = await one('select j.*, s.building_type, o.name as org from public.jobs j join public.sites s on s.id = j.site_id join public.organizations o on o.id = j.org_id where j.id = $1', [jobId]);
ok(/^EZ-23\d\d$/.test(job.number) && job.kind === 'survey', `convert_lead makes job ${job.number}`);
ok(job.building_type === 'multifamily' && job.org === 'Dana Kim', 'client and building created from the lead');
ok((await one('select status from public.leads where id = $1', [lead.id])).status === 'survey', 'lead moves to survey');
await rejects(db.query(`delete from public.leads where id = $1`, [lead.id]), 'nobody deletes through the API, staff included');
await db.query(`update public.jobs set stage = 'completed' where id = $1`, [jobId]);
ok(!!(await one('select closed_at from public.jobs where id = $1', [jobId])).closed_at, 'completing a job stamps closed_at');
await db.query(`insert into public.notes (job_id, body, client_visible) values ($1, 'Survey done', true), ($1, 'Internal: price high', false)`, [jobId]);
await db.query(`insert into public.org_members (org_id, user_id) values ($1, $2)`, [job.org_id, CLIENT]);
const other = await one(`insert into public.organizations (name) values ('Other Co') returning id`);
await db.query(`insert into public.jobs (org_id, title) values ($1, 'Other job')`, [other.id]);

// client
await as('authenticated', CLIENT);
ok((await db.query('select * from public.leads')).rows.length === 0, 'client cannot see leads');
const cj = (await db.query('select title from public.jobs')).rows;
ok(cj.length === 1 && cj[0].title.startsWith('Survey'), 'client sees only own jobs');
ok((await db.query('select body from public.notes')).rows.map((r) => r.body).join() === 'Survey done', 'client sees only client-visible notes');
await db.query(`insert into public.jobs (org_id, site_id, title, priority) values ($1, $2, 'Lobby camera offline', 'urgent')`, [job.org_id, job.site_id]);
ok(true, 'client can open a service request');
await rejects(db.query(`insert into public.jobs (org_id, title, stage) values ($1, 'x', 'completed')`, [job.org_id]), 'client cannot open a closed job');
await rejects(db.query(`insert into public.jobs (org_id, title) values ($1, 'x')`, [other.id]), 'client cannot open jobs for another client');
await rejects(db.query(`update public.sites set plan = 'managed'`).then((r) => { if (r.affectedRows === 0) throw new Error('no rows'); }), 'client cannot change the care plan');

await rejects(db.query(`select public.user_id_by_email('mansur@eztek.us')`), 'signed-in users cannot look up accounts by email');

// stranger
await as('authenticated', OTHER);
ok((await db.query('select * from public.jobs')).rows.length === 0, 'signed-in stranger sees nothing');

// billing, QR stickers, portal summary
await as('authenticated', STAFF);
const sys = await one(`insert into public.systems (site_id, service, name, status) values ($1, 'video-surveillance', 'Lobby camera 4', 'bad') returning id, qr`, [job.site_id]);
const otherSite = await one(`insert into public.sites (org_id, name, address) values ($1, 'Other bldg', '1 Other St') returning id`, [other.id]);
const otherSys = await one(`insert into public.systems (site_id, service, name) values ($1, 'access-control', 'Door') returning id`, [otherSite.id]);
await db.query(`update public.jobs set tech_id = $1 where id = $2`, [STAFF, jobId]);
await as('service_role'); // invoices only come from the Stripe webhook
await db.query(`insert into public.invoices (org_id, number, amount_due, status, hosted_url) values ($1, 'INV-1', 349, 'open', 'https://invoice.stripe.com/x'), ($2, 'INV-2', 99, 'open', null)`, [job.org_id, other.id]);

await as('anon');
ok((await one(`select public.qr_label($1) as l`, [sys.qr])).l === 'Lobby camera 4 · 100 Shore Rd, Brooklyn', 'QR page shows the system name');
await db.query(`insert into public.leads (ref, kind, urgency, name, phone, message, source) values ('S-QR-1', 'service', 'urgent', 'Tenant 4B', '7185550111', 'Camera dark', $1)`, [JSON.stringify({ qr: sys.qr })]);
await db.query(`insert into public.leads (ref, kind, name, system_id) values ('S-QR-2', 'service', 'Spoofer', $1)`, [otherSys.id]);
await db.query(`insert into public.leads (ref, kind, name, source) values ('S-QR-3', 'service', 'Broken link', $1)`, [JSON.stringify({ qr: '-'.repeat(36) })]);
ok(true, 'a malformed sticker id does not lose the lead');
await db.query(`insert into public.leads (ref, kind, name, source) values ('S-QR-4', 'service', 'Caps', $1)`, [JSON.stringify({ qr: sys.qr.toUpperCase() })]);

await as('authenticated', STAFF);
ok((await one(`select system_id from public.leads where ref = 'S-QR-1'`)).system_id === sys.id, 'QR lead is linked to the system');
ok((await one(`select system_id from public.leads where ref = 'S-QR-2'`)).system_id === null, 'website cannot link a lead to a system directly');
ok((await one(`select system_id from public.leads where ref = 'S-QR-4'`)).system_id === sys.id, 'an upper-case sticker id still links the system');
const qrJobId = (await one(`select public.convert_lead((select id from public.leads where ref = 'S-QR-1'), 'service') as id`)).id;
const qrJob = await one('select site_id, org_id, system_id from public.jobs where id = $1', [qrJobId]);
await db.query(`update public.jobs set scheduled_start = now() + interval '1 day', stage = 'scheduled' where id = $1`, [qrJobId]);
ok(qrJob.system_id === sys.id && qrJob.site_id === job.site_id && qrJob.org_id === job.org_id, 'QR lead becomes a job on the right building, no new client');

await as('authenticated', CLIENT);
const inv = (await db.query('select number from public.invoices')).rows;
ok(inv.length === 1 && inv[0].number === 'INV-1', 'client sees only own invoices');
await rejects(db.query(`insert into public.invoices (org_id, amount_due) values ($1, 1)`, [job.org_id]), 'client cannot create invoices');
await as('authenticated', STAFF);
await rejects(db.query(`update public.invoices set status = 'paid'`), 'staff cannot edit invoices by hand');
await as('authenticated', CLIENT);
ok((await db.query('select name from public.staff')).rows.map((r) => r.name).join() === 'Mansur', 'client sees the name of their technician');
await rejects(db.query('select phone from public.staff'), "client cannot read the technician's phone");
const sum = await one('select * from public.portal_summary');
ok(Number(sum.balance_due) === 349 && Number(sum.needs_attention) === 1 && !!sum.next_visit, 'portal summary for own organization');
ok((await db.query('select * from public.portal_summary')).rows.length === 1, 'portal summary hides other organizations');
await db.query(`insert into public.jobs (org_id, site_id, system_id, title) values ($1, $2, $3, 'Camera dark again')`, [job.org_id, job.site_id, sys.id]);
ok(true, 'client can report one of their systems');
await rejects(db.query(`insert into public.jobs (org_id, system_id, title) values ($1, $2, 'x')`, [job.org_id, otherSys.id]), "client cannot report another client's system");

// proposals: written by staff, opened and accepted by the client through a secret link
await as('authenticated', STAFF);
const prop = await one(`insert into public.proposals (job_id, title, schedule, options) values ($1, 'Lobby intercom upgrade', 'Start about Nov 15; done about Nov 20', $2) returning id, number, org_id, home_improvement`, [jobId, JSON.stringify([
  { key: 'a', name: 'Essential', lines: [{ desc: 'Video intercom panel', qty: 1, price: 4200 }, { desc: 'Installation', qty: 1, price: 1800 }] },
  { key: 'b', name: 'Recommended', lines: [{ desc: 'Video intercom panel', qty: 1, price: 4200 }, { desc: 'Lobby cameras', qty: 4, price: 650.5 }] },
])]);
ok(/^P-\d{4}$/.test(prop.number) && prop.org_id === job.org_id, `staff write proposal ${prop.number} for the job's client`);
ok(prop.home_improvement === true, 'a proposal for an apartment building follows the home improvement rules');
prop.token = (await one('select token from public.proposal_tokens($1) where id = $2', [jobId, prop.id])).token;
ok(!!prop.token, 'staff get the client link through proposal_tokens');
await rejects(db.query(`insert into public.proposals (job_id, title, options) values ($1, 'Bad', '[{"key":"a","name":"A","lines":[{"desc":"x","qty":1,"price":"abc"}]}]')`, [jobId]), 'malformed options are rejected');
await rejects(db.query(`insert into public.proposals (job_id, title, status) values ($1, 'Pre-accepted', 'accepted')`, [jobId]), 'a proposal cannot start out accepted');
await as('anon');
await rejects(db.query('select * from public.proposals'), 'website cannot list proposals');
ok((await one('select public.proposal_by_token($1) as p', [prop.token])).p === null, 'a draft is not visible by its link');
await as('authenticated', STAFF);
await db.query(`update public.proposals set status = 'sent', sent_at = now() where id = $1`, [prop.id]);
ok((await one('select public.proposal_by_token($1) as p', [prop.token])).p.status === 'sent', 'staff opening the link do not mark it viewed');
await rejects(db.query(`update public.proposals set options = '[]' where id = $1`, [prop.id]), 'a sent proposal cannot be edited');
await db.query(`insert into public.proposals (job_id, title) values ($1, 'Unsent draft')`, [jobId]);
await as('anon');
const seen = (await one('select public.proposal_by_token($1) as p', [prop.token])).p;
ok(seen.status === 'viewed' && Number(seen.options[1].total) === 6802 && seen.client === 'Dana Kim', 'the link shows options with totals and marks it viewed');
ok((await one('select public.proposal_by_token($1) as p', ['44444444-4444-4444-8444-444444444444'])).p === null, 'a wrong link shows nothing');
await rejects(db.query('select public.accept_proposal($1, $2, $3)', [prop.token, 'z', 'Dana Kim']), 'cannot accept an option that does not exist');
await rejects(db.query('select public.accept_proposal($1, $2, $3)', [prop.token, 'b', ' ']), 'accepting needs a typed name');
const acc = (await one('select public.accept_proposal($1, $2, $3) as p', [prop.token, 'b', 'Dana Kim'])).p;
ok(acc.status === 'accepted' && Number(acc.deposit_amount) === 3401 && acc.deposit_status === 'pending', 'accepting sets a 50% deposit due');
await rejects(db.query('select public.accept_proposal($1, $2, $3)', [prop.token, 'a', 'Dana Kim']), 'a proposal is accepted only once');
await rejects(db.query(`update public.proposals set deposit_status = 'paid'`), 'website cannot mark a deposit paid');
await as('authenticated', STAFF);
ok((await one('select status from public.leads where id = $1', [lead.id])).status === 'won', 'accepting marks the lead won');
await rejects(db.query(`update public.proposals set options = '[]' where id = $1`, [prop.id]), 'an accepted proposal cannot be edited');
await as('authenticated', CLIENT);
ok((await db.query('select number from public.proposals')).rows.length === 1, 'the client sees their sent proposal, not drafts');
await rejects(db.query('select token from public.proposals'), 'clients cannot read proposal links');
ok((await db.query('select * from public.proposal_tokens($1)', [jobId])).rows.length === 0, 'proposal_tokens gives clients nothing');
await rejects(db.query(`update public.proposals set deposit_status = 'paid'`).then((r) => { if (!r.affectedRows) throw new Error('no rows'); }), 'clients cannot change a proposal');
ok((await db.query(`select body from public.notes where body like 'Proposal%'`)).rows.length === 1, 'the client sees the acceptance note');
await as('authenticated', OTHER);
ok((await db.query('select id from public.proposals')).rows.length === 0, 'other clients do not see it');
await as('authenticated', STAFF);
const staleId = (await one(`insert into public.proposals (job_id, title, status, valid_until, options) values ($1, 'Old offer', 'sent', current_date - 2, $2) returning id`, [jobId, JSON.stringify([{ key: 'a', name: 'A', lines: [] }])])).id;
const stale = await one('select token from public.proposal_tokens($1) where id = $2', [jobId, staleId]);
await as('anon');
await rejects(db.query('select public.accept_proposal($1, $2, $3)', [stale.token, 'a', 'Dana Kim']), 'an expired proposal cannot be accepted');
ok((await one('select public.proposal_by_token($1) as p', [stale.token])).p.status === 'expired', 'an expired proposal shows as expired');
await as('service_role');
await db.query(`update public.proposals set deposit_status = 'paid' where id = $1`, [prop.id]);
ok(true, 'the Stripe webhook can mark the deposit paid');

// New York home improvement rules: dates before sending, three business days to cancel
await as('authenticated', STAFF);
const hi = await one(`insert into public.proposals (job_id, title, options) values ($1, 'Second building', $2) returning id`, [jobId, JSON.stringify([{ key: 'a', name: 'A', lines: [{ desc: 'Panel', qty: 1, price: 1000 }] }])]);
await rejects(db.query(`update public.proposals set status = 'sent' where id = $1`, [hi.id]), 'a home improvement proposal needs dates before it is sent');
await db.query(`update public.proposals set schedule = 'Start about Dec 1; done about Dec 3', status = 'sent' where id = $1`, [hi.id]);
ok((await one('select issued_by from public.proposals where id = $1', [hi.id])).issued_by === 'Mansur', 'the sender signs it for EZTek');
const hiToken = (await one('select token from public.proposal_tokens($1) where id = $2', [jobId, hi.id])).token;
const plain = await one(`insert into public.proposals (job_id, title, home_improvement, options) values ($1, 'Office cabling', false, $2) returning id`, [jobId, JSON.stringify([{ key: 'a', name: 'A', lines: [{ desc: 'Drop', qty: 2, price: 200 }] }])]);
await db.query(`update public.proposals set status = 'sent' where id = $1`, [plain.id]);
const plainToken = (await one('select token from public.proposal_tokens($1) where id = $2', [jobId, plain.id])).token;
await as('anon');
const signed = (await one('select public.accept_proposal($1, $2, $3) as p', [hiToken, 'a', 'Dana Kim'])).p;
const days = (new Date(signed.cancel_until) - new Date(signed.accepted_at)) / 864e5;
ok(signed.home_improvement && days > 3 && days < 6.1, 'accepting starts a three-business-day cancellation period');
const cancelled = (await one('select public.cancel_proposal($1) as p', [hiToken])).p;
ok(cancelled.status === 'declined' && !!cancelled.cancelled_at && cancelled.deposit_status === 'none', 'the owner can cancel online within the period');
await rejects(db.query('select public.cancel_proposal($1)', [hiToken]), 'a cancelled contract cannot be cancelled again');
ok((await one('select public.accept_proposal($1, $2, $3) as p', [plainToken, 'a', 'Dana Kim'])).p.cancel_until === null, 'a commercial job has no cancellation period');
await rejects(db.query('select public.cancel_proposal($1)', [plainToken]), 'and cannot be cancelled online');
await as('');
await db.query(`update public.proposals set cancel_until = now() - interval '1 minute' where id = $1`, [prop.id]);
await as('anon');
await rejects(db.query('select public.cancel_proposal($1)', [prop.token]), 'after the period the contract cannot be cancelled online');

// pro network: installers and partner businesses apply; only staff read applications
await as('anon');
await db.query(`insert into public.pros (kind, name, company, phone, trades, boroughs, alarm_license, insured) values ('partner', 'Sam Lee', 'Lee Low Voltage LLC', '7185550144', '{access-control,video-surveillance}', '{Brooklyn,Queens}', '12000123456', true)`);
ok(true, 'an installer can apply on the website');
await rejects(db.query('select * from public.pros'), 'the website cannot read applications');
await rejects(db.query(`insert into public.pros (kind, name, phone, status) values ('employee', 'Self Approved', '7185550145', 'approved')`), 'an applicant cannot approve themselves');
await rejects(db.query(`insert into public.pros (kind, name, phone, trades) values ('employee', 'Odd Trade', '7185550146', '{plumbing}')`), 'only EZTek trades are accepted');
await rejects(db.query(`insert into public.pros (kind, name, phone, agreement_at) values ('partner', 'Pre Signed', '7185550147', now())`), 'an applicant cannot sign the agreement in advance');
await rejects(db.query(`insert into public.pros (kind, name, phone, token) values ('partner', 'Own Link', '7185550148', '66666666-6666-4666-8666-666666666666')`), 'an applicant cannot pick the private link');
await as('authenticated', STAFF);
const pro = await one(`select id, status from public.pros where name = 'Sam Lee'`);
ok(pro?.status === 'applied', 'staff see the application');
await db.query(`update public.pros set status = 'approved', staff_notes = 'License checked on DOS lookup' where id = $1`, [pro.id]);
ok(true, 'staff approve it');
await as('authenticated', CLIENT);
ok((await db.query('select id from public.pros')).rows.length === 0, 'clients cannot see installers');

// dispatch: the nearest approved pros get the job; the first to accept takes it and can bring helpers
await as('');
await db.query(`update public.jobs set stage = 'received' where id = $1`, [jobId]); // reopened for the dispatch tests
await db.query(`update public.pros set lat = 40.7644, lng = -73.9235, radius_miles = 25 where name = 'Sam Lee'`); // Astoria
const near = await one(`insert into public.pros (kind, name, phone, status, lat, lng, radius_miles) values ('employee', 'Ana Ruiz', '7185550155', 'approved', 40.6290, -74.0260, 15) returning id, token`); // Bay Ridge
const far = await one(`insert into public.pros (kind, name, phone, status, lat, lng, radius_miles) values ('employee', 'Far Away', '7185550166', 'approved', 41.2, -73.7, 10) returning id`);
const sam = await one(`select id, token from public.pros where name = 'Sam Lee'`);
await as('authenticated', STAFF);
const offered = (await db.query('select * from public.offer_job($1, $2, $3, 3, 400)', [jobId, 40.6265, -74.0360])).rows;
ok(offered.length === 2 && offered[0].name === 'Ana Ruiz' && Number(offered[0].miles) < Number(offered[1].miles), 'a job goes to the nearest pros first');
ok(!offered.some((o) => o.name === 'Far Away'), 'pros outside their radius are left out');
ok((await one('select lat from public.sites where id = $1', [job.site_id])).lat === 40.6265, 'the building keeps its location');
await as('anon');
await rejects(db.query('select * from public.job_offers'), 'the website cannot list offers');
const home = (await one('select public.pro_home($1) as h', [sam.token])).h;
ok(home.offers.length === 1 && home.offers[0].address === null && home.offers[0].borough === 'Brooklyn', 'a pro sees the offer and the area, not the address yet');
ok(home.offers[0].title === null && home.offers[0].description === null && home.offers[0].crew === null, "nor the client's own words or the other pros");
const samOffer = home.offers[0].id;
await rejects(db.query('select public.pro_respond($1, $2, true)', [sam.token, samOffer]), 'a partner signs the agreement before taking jobs');
await db.query('select public.pro_sign($1, $2)', [sam.token, 'Sam Lee']);
const took = (await one('select public.pro_respond($1, $2, true) as h', [sam.token, samOffer])).h;
ok(took.offers[0].status === 'accepted' && took.offers[0].address === '100 Shore Rd, Brooklyn', 'after accepting, the pro sees the address');
const anaOffer = (await one('select public.pro_home($1) as h', [near.token])).h.offers;
ok(anaOffer.length === 0, 'the other offers are withdrawn once one pro takes the job');
const helpers = (await db.query('select * from public.pro_helpers($1, $2)', [sam.token, samOffer])).rows;
ok(helpers.length >= 1 && helpers[0].name === 'Ana Ruiz', 'the lead pro sees nearby pros to bring in');
await rejects(db.query('select public.pro_invite($1, $2, $3)', [near.token, samOffer, far.id]), 'only the lead pro brings in helpers');
await db.query('select public.pro_invite($1, $2, $3, $4)', [sam.token, samOffer, near.id, 'Two doors, need a second pair of hands']);
const anaHome = (await one('select public.pro_home($1) as h', [near.token])).h;
ok(anaHome.offers.length === 1 && anaHome.offers[0].role === 'helper', 'the helper gets it on their own link');
await db.query('select public.pro_respond($1, $2, true)', [near.token, anaHome.offers[0].id]);
const doneHome = (await one('select public.pro_done($1, $2, $3) as h', [sam.token, samOffer, 'Panel installed, tested'])).h;
ok(doneHome.offers[0].status === 'done', 'the lead pro reports the work done');
await as('');
await db.query(`update public.jobs set stage = 'completed' where id = $1`, [jobId]);
const late = await one(`insert into public.job_offers (job_id, pro_id) values ($1, $2) returning id, (select token from public.pros where id = $2) as token`, [jobId, far.id]);
await as('anon');
ok((await one('select public.pro_home($1) as h', [late.token])).h.offers.length === 0, 'offers on a finished job drop off');
await rejects(db.query('select public.pro_respond($1, $2, true)', [late.token, late.id]), 'and cannot be taken');
ok((await one('select public.pro_home($1) as h', ['55555555-5555-4555-8555-555555555555'])).h === null, 'a wrong pro link shows nothing');

// reviews: the client rates the finished job; published ones show on the site
await as('authenticated', STAFF);
const rt = (await one('select review_token from public.jobs where id = $1', [jobId])).review_token;
await as('anon');
const info = (await one('select public.review_info($1) as r', [rt])).r;
ok(info.number === job.number && info.pros.includes('Sam Lee'), 'the review link shows the job and who did it');
await rejects(db.query('select public.submit_review($1, 6, $2, $3, true)', [rt, 'x', 'Dana K.']), 'ratings are 1 to 5');
await db.query('select public.submit_review($1, 5, $2, $3, true)', [rt, 'On time, clean work.', 'Dana K.']);
const pub = (await db.query('select * from public.public_reviews()')).rows;
ok(pub.length === 1 && pub[0].author === 'Dana K.' && pub[0].rating === 5, 'a published review shows on the site');
ok((await one('select public.pro_home($1) as h', [sam.token])).h.rating === 5, "the pro's rating counts it");
await rejects(db.query('select * from public.reviews'), 'the website cannot read reviews directly');
await rejects(db.query('select * from public.prospects'), 'the website cannot read prospects');
await as('service_role');
const permit = await one(`insert into public.prospects (source_id, filed_on, job_type, address, borough, owner_business, cost, units) values ('B01429125-I1', '2026-10-30', 'Alteration CO', '1407 LINDEN BOULEVARD', 'Brooklyn', 'Summit Property Management', 329095, 141) returning id`);
await db.query(`insert into public.prospects (source_id) values ('B01429125-I1') on conflict do nothing`);
ok((await db.query('select id from public.prospects')).rows.length === 1, 'a permit is stored once');
await as('authenticated', CLIENT);
await rejects(db.query('select public.prospect_to_lead($1)', [permit.id]), 'clients cannot turn prospects into leads');
await as('authenticated', STAFF);
const fromPermit = (await one('select public.prospect_to_lead($1) as id', [permit.id])).id;
const pl = await one('select name, building, source from public.leads where id = $1', [fromPermit]);
ok(pl.name === 'Summit Property Management' && pl.building === '141 units' && pl.source.permit === 'B01429125-I1', 'staff turn a permit into a lead in one step');
await rejects(db.query('select public.prospect_to_lead($1)', [permit.id]), 'a prospect becomes a lead once');
await as('service_role');
const intercom = await one(`insert into public.prospects (source, source_id, filed_on, job_type, address, borough, owner_business, agent, violations, description) values ('nyc-hpd', '345678', '2026-10-20', 'HPD intercom violation', '2101 86 STREET', 'Brooklyn', 'Bay Ridge Gardens LLC', 'Anna Petrova', 3, 'Class B. Repair the broken or defective intercom system. Apartments: 2A, 4C.') returning id`);
await db.query(`insert into public.prospects (source, source_id, violations) values ('nyc-hpd', '345678', 4) on conflict (source, source_id) do update set violations = excluded.violations`);
const hp = await one(`select count(*)::int as n, max(violations) as v, max(status) as s from public.prospects where source = 'nyc-hpd'`);
ok(hp.n === 1 && hp.v === 4 && hp.s === 'new', 'a building with intercom violations is stored once and its count refreshes');
await rejects(db.query(`insert into public.prospects (source, source_id, violations) values ('nyc-hpd', 'x', -1)`), 'violation counts are not negative');
await as('authenticated', STAFF);
const fromHpd = (await one('select public.prospect_to_lead($1) as id', [intercom.id])).id;
const hl = await one('select kind, name, building, systems, message, source from public.leads where id = $1', [fromHpd]);
ok(hl.kind === 'service' && hl.name === 'Bay Ridge Gardens LLC' && hl.building === '4 open HPD intercom violations' && hl.systems === 'intercom-entry'
  && hl.message.startsWith('Managing agent: Anna Petrova') && hl.source.hpd_building === '345678' && hl.source.channel === 'nyc-hpd' && !('permit' in hl.source),
  'staff turn a building with intercom violations into a service lead');
ok((await one('select source from public.leads where id = $1', [fromPermit])).source.permit === 'B01429125-I1', 'permit leads keep their permit number');
await as('authenticated', CLIENT);
ok((await db.query('select id from public.job_offers')).rows.length === 0, 'clients do not see offers to pros');

// photos and plans on a quote request
const FILES_LEAD = '11111111-1111-4111-8111-111111111111';
const upload = (folder, file) => db.query(`insert into storage.objects (bucket_id, name) values ('lead-files', $1)`, [`${folder}/${file}`]);
await as('');
await db.query(`update public.leads set created_at = now() - interval '2 hours' where id = $1`, [lead.id]);
await as('anon');
await db.query(`insert into public.leads (id, ref, kind, name, phone) values ($1, 'Q-1101-2222', 'quote', 'File Sender', '7185550122')`, [FILES_LEAD]);
await upload(FILES_LEAD, 'lobby.jpg');
ok(true, 'website can attach a file to a new lead');
await rejects(upload('not-a-lead', 'x.jpg'), 'files need a lead folder');
await rejects(upload('22222222-2222-4222-8222-222222222222', 'x.jpg'), 'files need an existing lead');
await rejects(upload(lead.id, 'x.jpg'), 'files cannot be added to an old lead');
ok((await db.query('select * from storage.objects')).rows.length === 0, 'website cannot list uploaded files');
for (let i = 2; i <= 10; i++) await upload(FILES_LEAD, `photo-${i}.jpg`);
await rejects(upload(FILES_LEAD, 'photo-11.jpg'), 'at most 10 files per lead');
await as('authenticated', STAFF);
ok((await db.query(`select name from storage.objects where bucket_id = 'lead-files'`)).rows.length === 10, 'staff see the files');
await as('authenticated', CLIENT);
ok((await db.query('select name from storage.objects')).rows.length === 0, 'clients cannot see request files');
const FRESH = '33333333-3333-4333-8333-333333333333';
await as('anon');
await db.query(`insert into public.leads (id, ref, kind, name, phone) values ($1, 'Q-1101-3333', 'quote', 'Late Sender', '7185550133')`, [FRESH]);
await as('');
await db.query(`insert into storage.objects (bucket_id, name) select 'lead-files', 'x/' || g from generate_series(1, 20) g`);
await as('anon');
await rejects(upload(FRESH, 'a.jpg'), 'site-wide cap of 20 uploads an hour');
await as('');
await db.query(`update storage.objects set created_at = now() - interval '3 hours'`);
await db.query(`insert into storage.objects (bucket_id, name, created_at) select 'lead-files', 'y/' || g, now() - interval '5 hours' from generate_series(1, 70) g`);
await as('anon');
await rejects(upload(FRESH, 'b.jpg'), 'site-wide cap of 40 uploads a day');
await as('');
await db.query(`delete from storage.objects where name like 'y/%'`);
await as('anon');
await upload(FRESH, 'c.jpg');
ok(true, 'uploads open again under the caps');

await as('service_role');
ok((await one(`select public.user_id_by_email('MANSUR@eztek.us') as id`)).id === STAFF, 'server functions can look up accounts by email');
await db.query(`update public.sites set plan_status = 'active' where id = $1`, [job.site_id]);
ok(true, 'server functions can update billing status');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
