# EZTek Solutions website

Website and client portal for EZTek Solutions, a low-voltage systems integrator in Brooklyn, NY (eztekav.com).

## Status
- Phase 1, clickable prototype: kept at `/prototype/` (`public/prototype/index.html`), including the demo client portal.
- Phase 2, step 1, marketing site and lead funnel: Astro static site, 34 pages. Preview at https://akhmedich.github.io/eztek-site/ after the deploy workflow runs on `main`.
- Phase 2, step 2, real client portal (sign-in, database, payments): not started. Open questions in `docs/brief.md`.

## Run locally
```bash
npm install
npm run dev        # http://localhost:4321/eztek-site/
npm run build      # static site in dist/
npm run check:launch
```

## Structure
- `src/data/` - all business content: `company.ts` (facts, contacts, hours, credentials), `services.ts`, `buildings.ts`, `areas.ts`, `plans.ts` (care plans, add-ons, quote estimate ranges), `proof.ts` (projects, quotes).
- `src/pages/` - home, 9 service pages, 6 building-type pages, 5 borough pages, care plans, quote wizard, service request, about, contact, partners, portal sign-in, privacy, terms, 404, sitemap.xml, robots.txt.
- `src/scripts/lead.ts` - sends form leads; records the first-touch source (UTM, referrer, landing page) with each lead.
- `public/prototype/` - the Phase 1 prototype.

## Example data (placeholders)
The owner asked to fill missing facts with example data until real data arrives (2026-10-31). Confirmed so far: name, address, phone, founding year 2000.
- Every example value is marked `PLACEHOLDER` in the source.
- `npm run check:launch` lists them and fails while any is left or `PREVIEW` is true in `src/data/company.ts`.
- Sample projects and client quotes show a "Sample" badge on the page. Never publish them as real.

## Forms
Without settings, forms run in preview mode: nothing is sent, and the success screen says so. To receive leads by email with Web3Forms, add repository variables (Settings > Secrets and variables > Actions > Variables):
- `PUBLIC_FORM_ENDPOINT` = `https://api.web3forms.com/submit`
- `PUBLIC_FORM_KEY` = the access key Web3Forms emails to the inbox that should get leads

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
