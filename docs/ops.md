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

Access rules (tested by `npm run test:db`, 33 cases): the website can only add leads and cannot read anything; staff see everything; a client sees only their own organization, buildings, jobs, invoices, client-visible notes and the name of their technician, and can open service requests for their own buildings and systems.

## One-time setup (owner, about 15 minutes)
Claude cannot create accounts or handle keys, so these steps are yours.

1. **Supabase project.** Go to supabase.com, sign in with GitHub, create a project named `eztek-ops` in region East US. Save the database password in your password manager.
2. **Connect Claude.** In a Claude Code session in this folder, set the project ref (the id in the project URL) as the environment variable `SUPABASE_PROJECT_REF`, then run `/mcp` and sign in to Supabase for the `eztek-ops` server. Claude can then apply the database schema from `supabase/migrations/` itself.
3. **Sign-in links.** In Supabase: Authentication > URL Configuration. Site URL `https://akhmedich.github.io/eztek-site/`, redirect URLs `https://akhmedich.github.io/eztek-site/admin/` and `https://akhmedich.github.io/eztek-site/portal/` (later the same on eztekav.com).
4. **Website connection.** In GitHub: repository Settings > Secrets and variables > Actions > Variables. Add `PUBLIC_SUPABASE_URL` (Project Settings > API > URL) and `PUBLIC_SUPABASE_ANON_KEY` (the `anon` public key; it is meant to be public and can only add leads).
5. **Email copies of leads to mansur@eztek.us.** On web3forms.com enter `mansur@eztek.us` to get an access key by email. Add the variables `PUBLIC_FORM_ENDPOINT` = `https://api.web3forms.com/submit` and `PUBLIC_FORM_KEY` = that key.
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

## Later
- Documents in the portal (as-builts, reports, COI) on Supabase Storage.
- Daily 8 AM summary from Claude to Mansur: new leads, emergencies, today's jobs.
- Own email sender for sign-in links (Supabase's built-in sender is limited to a few emails per hour).
- Text message updates to clients when a job is scheduled or completed.
