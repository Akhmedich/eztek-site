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
| `convert_lead(lead, kind)` | Creates the client, the building and the first job from a lead. |

Access rules (tested by `npm run test:db`): the website can only add leads and cannot read anything; staff see everything; a client sees only their own organization, buildings, jobs and client-visible notes, and can open service requests.

## One-time setup (owner, about 15 minutes)
Claude cannot create accounts or handle keys, so these steps are yours.

1. **Supabase project.** Go to supabase.com, sign in with GitHub, create a project named `eztek-ops` in region East US. Save the database password in your password manager.
2. **Connect Claude.** In a Claude Code session in this folder, set the project ref (the id in the project URL) as the environment variable `SUPABASE_PROJECT_REF`, then run `/mcp` and sign in to Supabase for the `eztek-ops` server. Claude can then apply the database schema from `supabase/migrations/` itself.
3. **Sign-in links.** In Supabase: Authentication > URL Configuration. Site URL `https://akhmedich.github.io/eztek-site/`, redirect URLs `https://akhmedich.github.io/eztek-site/admin/` and `https://akhmedich.github.io/eztek-site/portal/` (later the same on eztekav.com).
4. **Website connection.** In GitHub: repository Settings > Secrets and variables > Actions > Variables. Add `PUBLIC_SUPABASE_URL` (Project Settings > API > URL) and `PUBLIC_SUPABASE_ANON_KEY` (the `anon` public key; it is meant to be public and can only add leads).
5. **Email copies of leads to mansur@eztek.us.** On web3forms.com enter `mansur@eztek.us` to get an access key by email. Add the variables `PUBLIC_FORM_ENDPOINT` = `https://api.web3forms.com/submit` and `PUBLIC_FORM_KEY` = that key.
6. **Staff.** Mansur opens `/admin/` and signs in with the email link once. Then ask Claude: "add Mansur to staff as admin".

Re-run the deploy (Actions > Build and deploy > Run workflow) after changing variables.

## Later
- Client portal on the same database: sign-in, buildings, requests, documents, Stripe billing for care plans.
- Daily 8 AM summary from Claude to Mansur: new leads, emergencies, today's jobs.
- QR stickers that open a service request for the exact system.
- Own email sender for sign-in links (Supabase's built-in sender is limited to a few emails per hour).
