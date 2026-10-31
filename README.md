# EZTek Solutions website

Website and client portal for EZTek Solutions, a low-voltage systems integrator in Brooklyn, NY (eztekav.com).

## Status
- Phase 1, clickable prototype: `index.html`, published with GitHub Pages at https://akhmedich.github.io/eztek-site/ (no build step). Prices and portal data are drafts and demo data.
- Phase 2, production: not started. Planned stack and open questions are in `docs/brief.md`.

## Structure
- `index.html` - single-file prototype: marketing site, quote wizard, service-call form, demo client portal. Edit on github.com; the site updates in about a minute.
- `docs/brief.md` - business facts, decisions, benchmarks, items still needed from the owner

## Rules
- Never invent business facts. Missing data stays as a visible placeholder.
- DNS for eztekav.com: never change MX or TXT records (email runs on Google Workspace). Cutover changes only `A @` and `CNAME www`, with owner approval.

## Preview access and indexing
The preview must not be indexed or public until the owner approves launch.
- The GitHub Pages link is open to anyone who has it; there is no login.
- Search engines: `noindex` meta tag in `index.html`, `robots.txt` with `Disallow: /`. `_headers` (X-Robots-Tag) applies only if the site moves to Cloudflare Pages.
- Remove all three only at launch.

## Team
- Akhmed Bektimirov: admin
- Mansur (mansur@eztek.us): admin
- Claude: works through the admin's account in Claude sessions; no separate GitHub account
