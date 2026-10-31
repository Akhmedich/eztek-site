# EZTek Solutions website

Website and client portal for EZTek Solutions, a low-voltage systems integrator in Brooklyn, NY (eztekav.com).

## Status
- Phase 1, clickable prototype: `prototype/index.html` (open in a browser, no build step). Prices and portal data are drafts and demo data.
- Phase 2, production: not started. Planned stack and open questions are in `docs/brief.md`.

## Structure
- `prototype/` - single-file prototype: marketing site, quote wizard, service-call form, demo client portal
- `docs/brief.md` - business facts, decisions, benchmarks, items still needed from the owner

## Rules
- Never invent business facts. Missing data stays as a visible placeholder.
- DNS for eztekav.com: never change MX or TXT records (email runs on Google Workspace). Cutover changes only `A @` and `CNAME www`, with owner approval.
