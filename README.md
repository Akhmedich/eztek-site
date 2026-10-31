# EZTek Solutions website

Website and client portal for EZTek Solutions, a low-voltage systems integrator in Brooklyn, NY (eztekav.com).

## Status
- Phase 1, clickable prototype: kept at `/prototype/` (`public/prototype/index.html`), including the demo client portal.
- Phase 2, step 1, marketing site and lead funnel: Astro static site, 34 pages. Preview at https://akhmedich.github.io/eztek-site/ after the deploy workflow runs on `main`.
- Phase 2, step 2, EZTek Ops (orders, jobs, clients) on Supabase: database schema with access rules, website forms write leads to it, staff dashboard at `/admin/`, Claude connected through the Supabase MCP server. Waiting for the one-time setup in `docs/ops.md`.
- Phase 2, step 3, client portal on the same database with Stripe billing: not started.

## Run locally
```bash
npm install
npm run dev        # http://localhost:4321/eztek-site/
npm run build      # static site in dist/
npm run check:launch
npm run test:db     # database access rules, in-memory Postgres
```

## Structure
- `src/data/` - all business content: `company.ts` (facts, contacts, hours, credentials), `services.ts`, `buildings.ts`, `areas.ts`, `plans.ts` (care plans, add-ons, quote estimate ranges), `proof.ts` (projects, quotes).
- `src/pages/` - home, 9 service pages, 6 building-type pages, 5 borough pages, care plans, quote wizard, service request, about, contact, partners, portal sign-in, privacy, terms, 404, sitemap.xml, robots.txt.
- `src/scripts/lead.ts` - sends form leads; records the first-touch source (UTM, referrer, landing page) with each lead.
- `src/pages/admin/` - staff dashboard: leads, jobs, clients.
- `supabase/migrations/` - database schema; `scripts/test-db.mjs` tests it.
- `.mcp.json` - connects Claude Code to the database (`eztek-ops`).
- `public/prototype/` - the Phase 1 prototype.

## Example data (placeholders)
The owner asked to fill missing facts with example data until real data arrives (2026-10-31). Confirmed so far: name, address, phone, founding year 2000.
- Every example value is marked `PLACEHOLDER` in the source.
- `npm run check:launch` lists them and fails while any is left or `PREVIEW` is true in `src/data/company.ts`.
- Sample projects and client quotes show a "Sample" badge on the page. Never publish them as real.

## Forms
Each lead goes to the `leads` table in Supabase and, as a copy, by email to mansur@eztek.us through Web3Forms. Either channel is enough for the form to succeed. Without settings, forms run in preview mode: nothing is sent, and the success screen says so. Setup: `docs/ops.md`.

## Launch on eztekav.com
1. Replace all placeholders, set `PREVIEW = false`, `npm run check:launch` passes.
2. Build with `SITE_URL=https://eztekav.com BASE_PATH=/`.
3. DNS: change only `A @` and `CNAME www`, with owner approval. Never change MX or TXT records (email runs on Google Workspace).

## Preview access and indexing
The preview must not be indexed until the owner approves launch: `noindex` meta tag on every page while `PREVIEW` is true. `public/_headers` (X-Robots-Tag) applies only on Cloudflare Pages.

## Team
- Akhmed Bektimirov: admin
- Mansur (mansur@eztek.us): admin
- Claude: works through the admin's account in Claude sessions; no separate GitHub account
