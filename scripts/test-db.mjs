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
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  -- Supabase grants these roles privileges on new objects by default; row level security decides
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
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
ok((await db.query('select * from public.leads')).rows.length === 0, 'anon cannot read leads back');
await rejects(db.query(`insert into public.leads (ref, kind, name, status) values ('Q-x', 'quote', 'Bot', 'won')`), 'anon cannot set lead status');
await rejects(db.query(`insert into public.jobs (title) values ('x')`), 'anon cannot create jobs');
await rejects(db.query(`select public.convert_lead(gen_random_uuid())`), 'anon cannot convert leads');
await rejects(db.query(`select public.user_id_by_email('mansur@eztek.us')`), 'anon cannot look up accounts by email');
await rejects(db.query(`insert into public.leads (ref, kind, name) values ('Q-y', 'quote', repeat('a', 300))`), 'over-long name is rejected');

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

// stranger
await as('authenticated', OTHER);
ok((await db.query('select * from public.jobs')).rows.length === 0, 'signed-in stranger sees nothing');

// billing, QR stickers, portal summary
await as('authenticated', STAFF);
const sys = await one(`insert into public.systems (site_id, service, name, status) values ($1, 'video-surveillance', 'Lobby camera 4', 'bad') returning id, qr`, [job.site_id]);
const otherSite = await one(`insert into public.sites (org_id, name, address) values ($1, 'Other bldg', '1 Other St') returning id`, [other.id]);
const otherSys = await one(`insert into public.systems (site_id, service, name) values ($1, 'access-control', 'Door') returning id`, [otherSite.id]);
await db.query(`update public.jobs set tech_id = $1 where id = $2`, [STAFF, jobId]);
await db.query(`insert into public.invoices (org_id, number, amount_due, status, hosted_url) values ($1, 'INV-1', 349, 'open', 'https://invoice.stripe.com/x'), ($2, 'INV-2', 99, 'open', null)`, [job.org_id, other.id]);

await as('anon');
ok((await one(`select public.qr_label($1) as l`, [sys.qr])).l === 'Lobby camera 4 · 100 Shore Rd, Brooklyn', 'QR page shows the system name');
await db.query(`insert into public.leads (ref, kind, urgency, name, phone, message, source) values ('S-QR-1', 'service', 'urgent', 'Tenant 4B', '7185550111', 'Camera dark', $1)`, [JSON.stringify({ qr: sys.qr })]);
await db.query(`insert into public.leads (ref, kind, name, system_id) values ('S-QR-2', 'service', 'Spoofer', $1)`, [otherSys.id]);

await as('authenticated', STAFF);
ok((await one(`select system_id from public.leads where ref = 'S-QR-1'`)).system_id === sys.id, 'QR lead is linked to the system');
ok((await one(`select system_id from public.leads where ref = 'S-QR-2'`)).system_id === null, 'website cannot link a lead to a system directly');
const qrJobId = (await one(`select public.convert_lead((select id from public.leads where ref = 'S-QR-1'), 'service') as id`)).id;
const qrJob = await one('select site_id, org_id, system_id from public.jobs where id = $1', [qrJobId]);
await db.query(`update public.jobs set scheduled_start = now() + interval '1 day', stage = 'scheduled' where id = $1`, [qrJobId]);
ok(qrJob.system_id === sys.id && qrJob.site_id === job.site_id && qrJob.org_id === job.org_id, 'QR lead becomes a job on the right building, no new client');

await as('authenticated', CLIENT);
const inv = (await db.query('select number from public.invoices')).rows;
ok(inv.length === 1 && inv[0].number === 'INV-1', 'client sees only own invoices');
await rejects(db.query(`insert into public.invoices (org_id, amount_due) values ($1, 1)`, [job.org_id]), 'client cannot create invoices');
ok((await db.query('select name from public.staff')).rows.map((r) => r.name).join() === 'Mansur', 'client sees the name of their technician');
const sum = await one('select * from public.portal_summary');
ok(Number(sum.balance_due) === 349 && Number(sum.needs_attention) === 1 && !!sum.next_visit, 'portal summary for own organization');
ok((await db.query('select * from public.portal_summary')).rows.length === 1, 'portal summary hides other organizations');
await db.query(`insert into public.jobs (org_id, site_id, system_id, title) values ($1, $2, $3, 'Camera dark again')`, [job.org_id, job.site_id, sys.id]);
ok(true, 'client can report one of their systems');
await rejects(db.query(`insert into public.jobs (org_id, system_id, title) values ($1, $2, 'x')`, [job.org_id, otherSys.id]), "client cannot report another client's system");

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
