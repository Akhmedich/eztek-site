# EZTek Ops: orders, jobs and clients

## Why this setup
EZTek had no order system. Instead of renting field-service software (Jobber from about $169/mo, ServiceTitan from about $300 per technician per month, prices to re-check before comparing), orders live in EZTek's own database on Supabase:

- **One database** behind everything: website forms, the staff dashboard (`/admin/`), the client portal (next step) and Claude.
- **Claude works in it directly** through Supabase's official MCP connector: "what came in overnight", "create a survey for Q-1031-1111", "book Marcus for Tuesday 9-11", "weekly report by source".
- **Cost:** free tier to start; Supabase Pro is $25/mo when needed (check current pricing).
- **Owned by EZTek:** plain Postgres, exportable at any time.
- **Payments:** Stripe, in the portal step.

## What is in it
| Table | What |
|---|---|
| `leads` | Every website request: quote, service, contact, partner. Status: new > contacted > survey > proposal > won / lost / spam. |
| `organizations` | Clients: management companies, boards, owners, businesses, homeowners. |
| `sites` | Buildings, with care plan. |
| `systems` | Installed systems per building, status, warranty, QR sticker id. |
| `jobs` | Work orders `EZ-2300`, `EZ-2301`...: survey, install, service, maintenance, programming. Stage: received > scheduled > assigned > on site > completed / cancelled. |
| `notes` | Timeline on a lead or a job; `client_visible` notes show in the portal. |
| `staff` | Who can use the dashboard. |
| `org_members` | Client users and their organization. |
| `ops_today` (view) | One-row summary: new leads, emergencies, leads waiting over an hour, unscheduled jobs, systems down. |
| `invoices` | Invoices mirrored from Stripe; clients pay on the Stripe page. |
| `portal_summary` (view) | Per client: open requests, systems needing attention, next visit, balance due. |
| `convert_lead(lead, kind)` | Creates the client, the building and the first job from a lead. A lead from a QR sticker goes straight to that client's building and system. |
| `qr_label(qr)` | Name of the system behind a sticker, for the public report page. |
| Storage `lead-files` | Photos and plans attached to a quote request, in a private bucket: `lead-files/<lead id>/`. Only staff can open them (in the lead in `/admin/`). Up to 10 files per request, 5 MB each; the whole site takes at most 20 uploads an hour and 40 a day (at worst 200 MB a day of the free 1 GB). Files cannot be removed through the API: clear old ones now and then in Supabase > Storage. Photos are shrunk in the browser first. |

## Pages
- `/admin/` staff: leads, jobs, clients; add systems to a building, invite client users, open QR report pages.
- `/admin/stickers/?site=…` printable QR stickers (2 x 2 in) for every system in a building.
- `/portal/` clients: overview, requests with progress and messages, buildings and systems, care plans and invoices.
- `/r/?q=…` the page behind a sticker: anyone in the building reports a problem; it arrives linked to the system.

## Server functions (`supabase/functions/`)
| Function | What |
|---|---|
| `billing-checkout` | Starts a care plan subscription for a building on Stripe Checkout; if one exists, opens the Stripe billing portal. |
| `billing-portal` | Stripe billing portal: cards, ACH bank accounts, autopay, invoices, cancel. |
| `stripe-webhook` | Updates plan status per building and the invoice list from Stripe events. |
| `invite-member` | Gives a person portal access and emails the sign-in link. Staff invite anyone; client admins invite to their own account. |
| `assistant` | The website assistant (Claude): answers questions from the facts in `src/data` and takes requests, by text or voice. Deployed without JWT check; it accepts only the site's own addresses and the widget's message shapes, and limits how often one visitor can ask. A determined script can still fake those, so the Anthropic spend limit is the real cap. |

Access rules (tested by `npm run test:db`, 56 cases, with automatic table exposure off): the website can only add leads and cannot read anything; staff see everything; a client sees only their own organization, buildings, jobs, invoices, client-visible notes and the name of their technician (never the phone), and can open service requests for their own buildings and systems. Nobody deletes rows through the API, and invoices change only through the Stripe webhook.

## One-time setup (owner, about 15 minutes)
Claude cannot create accounts or handle keys, so these steps are yours.

1. **Supabase project.** Go to supabase.com, sign in with GitHub, organization `Eztek` (type Company, plan Free), project `eztek-ops`, region Americas (East US). Save the database password in your password manager. Security settings:
   - Enable Data API: **on** (the site, dashboard and portal use it).
   - Automatically expose new tables: **off**. Access is granted table by table in `supabase/migrations/20261031190000_explicit_grants.sql`; nothing else is reachable.
   - Enable automatic RLS: **on** (a safety net; every table already has row level security).
   - Connect GitHub: skip for now. Migrations are applied by Claude through the connector after review.
2. **Connect Claude.** The project ref (`aechfgsnroxltupkpxbs`) is in `.mcp.json`. In a Claude Code session in this folder, run `/mcp`, pick `eztek-ops` and sign in to Supabase. Claude can then apply the database schema from `supabase/migrations/` itself.
3. **Sign-in links.** In Supabase: Authentication > URL Configuration. Site URL `https://akhmedich.github.io/eztek-site/`, redirect URLs `https://akhmedich.github.io/eztek-site/admin/` and `https://akhmedich.github.io/eztek-site/portal/` (later the same on eztekav.com).
4. **Website connection.** In GitHub: repository Settings > Secrets and variables > Actions > Variables. Add `PUBLIC_SUPABASE_URL` (the Project URL, `https://<ref>.supabase.co`) and `PUBLIC_SUPABASE_ANON_KEY` = the **publishable** key `sb_publishable_…` from Project Settings > API Keys (or the legacy `anon` key). It is meant to be public; with the access rules it can only add leads. Never put a secret or `service_role` key in the site.
5. **Email copies of leads.** One Web3Forms account, owned by the admin (Akhmed's Gmail), so every form can be edited at any time. Two forms in it, each with its own access key:
   - `eztek – test`: recipient Akhmed's Gmail, site `akhmedich.github.io/eztek-site`.
   - `eztek – production`: recipient `mansur@eztek.us`, site `eztekav.com`.
   Variables: `PUBLIC_FORM_ENDPOINT` = `https://api.web3forms.com/submit`, `PUBLIC_FORM_KEY` = one key, or several separated by commas to send a copy to each recipient. During the preview use the test key; at launch use `production-key,test-key` so both Mansur and the admin get every lead.
6. **Staff.** Mansur opens `/admin/` and signs in with the email link once. Then ask Claude: "add Mansur to staff as admin".

Re-run the deploy (Actions > Build and deploy > Run workflow) after changing variables.

## Online payments (owner, about 20 minutes)
1. **Stripe account** for EZTek at stripe.com (business details, bank account for payouts). Turn on cards and ACH Direct Debit (Settings > Payment methods).
2. **Products.** Create two monthly prices: Care plan Essential and Care plan Priority (amounts from `src/data/plans.ts` once the real prices are set). Managed stays a custom subscription that staff create in Stripe for each building.
3. **Billing portal.** Settings > Billing > Customer portal: allow updating payment methods, viewing invoices, switching between the two prices, and canceling at period end.
4. **Functions.** Ask Claude to deploy `billing-checkout`, `billing-portal`, `stripe-webhook` and `invite-member` through the `eztek-ops` connector, or run `npx supabase functions deploy` yourself.
5. **Webhook.** Stripe > Developers > Webhooks > add endpoint `https://<project ref>.supabase.co/functions/v1/stripe-webhook` with the events listed at the top of `supabase/functions/stripe-webhook/index.ts`.
6. **Secrets** (you enter them; Claude never handles keys). In Supabase: Edge Functions > Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ESSENTIAL`, `STRIPE_PRICE_PRIORITY`, `PORTAL_URL` = `https://akhmedich.github.io/eztek-site/portal/`.
7. **Test first.** Do all of the above in Stripe test mode, pay with Stripe's test card, check the plan turns active in `/admin/` and the invoice shows in the portal. Then repeat with live keys.

Until this is done, the portal's billing buttons say online billing is not set up and ask the client to call.

## Website assistant (owner, about 10 minutes)
A chat button on every public page ("Ask EZTek"). Visitors type or speak (Chrome, Edge, Safari), and the assistant answers out loud if they turn voice on. It answers only from confirmed facts: `npm run assistant:knowledge` builds its reference from `src/data` and leaves out every PLACEHOLDER value (prices, hours, licenses, ratings), so it never quotes them; for prices it sends people to `/quote/`. When a visitor wants a call back, it repeats the details, asks them to confirm and saves the request like a website form: a lead in EZTek Ops with `source.channel = assistant`, plus the usual email copy.

1. **Anthropic account** for EZTek at console.anthropic.com (billing on the business card). Set a monthly spend limit (Settings > Limits); each reply costs about a cent.
2. **Key.** Create an API key and enter it yourself in Supabase: Edge Functions > Secrets, `ANTHROPIC_API_KEY`. Claude never handles it.
3. **Function.** Ask Claude to deploy `assistant` (JWT check off), or run `npx supabase functions deploy assistant --no-verify-jwt`. If the site moves to a new address, add it to the `ASSISTANT_ORIGINS` secret (comma-separated; the default covers akhmedich.github.io, eztekav.com and www.eztekav.com).
4. **Turn it on.** GitHub repository variable `PUBLIC_ASSISTANT` = `on`, then re-run the deploy. Remove it to hide the button.

After changing services, buildings or areas in `src/data`, run `npm run assistant:knowledge`, commit the new `supabase/functions/assistant/knowledge.ts` and redeploy the function (CI fails if the file is out of date).

## Later
- Documents in the portal (as-builts, reports, COI) on Supabase Storage.
- Daily 8 AM summary from Claude to Mansur: new leads, emergencies, today's jobs.
- Own email sender for sign-in links (Supabase's built-in sender is limited to a few emails per hour).
- Text message updates to clients when a job is scheduled or completed.
- Voice secretary on the phone line: the same assistant answering calls to (888) 693-9835 after hours or when the line is busy, saving a lead and texting the team. Needs a phone provider account (Twilio or Telnyx) and a forwarding rule on the business number, about $1-2 per number per month plus per-minute charges (check current prices).
- A CAPTCHA (Cloudflare Turnstile) on forms and file uploads if spam shows up.
