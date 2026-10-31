# Notes for Claude sessions

- This repo is its own project. Do not mix it with other projects of the owner (facebook-marketplace and others): no shared memory notes, configs or launch files.
- Owner speaks Russian (often transliterated); reply in Russian, keep English terms translated.
- Work on `feature/*` or `fix/*` branches and open a pull request into `main` (CONTRIBUTING.md).
- Business facts live in `src/data/`. Confirmed: name, address 1707 70th St Brooklyn NY 11204, phone (888) 693-9835, founded 2000, leads go to mansur@eztek.us. Everything else is example data marked `PLACEHOLDER` at the owner's request; keep marking new example values the same way.
- Never present sample projects, quotes, ratings or license numbers as real outside the preview.
- DNS for eztekav.com: never touch MX or TXT. Cutover only `A @` and `CNAME www`, with owner approval.
- Orders, jobs and clients live in EZTek Ops (Supabase), decided by the owner's delegation 2026-10-31. Setup and schema: `docs/ops.md`. Schema changes go in a new file in `supabase/migrations/` and must pass `npm run test:db`.
- Next planned step: client portal on the same database, Stripe billing for care plans.

## Running operations through the `eztek-ops` MCP server
The database is live business data. Read freely; change carefully.

- "Что нового?" / morning check: `select * from ops_today;` then new leads, newest first, emergencies on top. Summarize per lead in one line: who, building, what they need, how long they have waited.
- Working a lead: read it with its notes. Draft the reply (email draft, never sent without the user's yes). Status changes and notes only when the user says so; add a note for every action, `author_name = 'Claude'`.
- Creating work: `select public.convert_lead('<lead id>', 'survey')` (or `'service'` for repairs). It creates the client, the building and job `EZ-####`, and moves the lead to `survey`.
- Scheduling: update `jobs.scheduled_start`, `scheduled_end`, `tech_id`, `stage`. Times are America/New_York.
- Reports: leads by `source->>'utm_source'` and `source->>'referrer'`, conversion new > won, open jobs by stage, systems with `status = 'bad'`.
- Never delete rows, never update more than one row at a time without the user confirming the list, never change `staff` or `org_members` without an explicit request.
- Schema changes: write a migration file, run `npm run test:db`, then apply it with the MCP `apply_migration` tool only after the user says yes.
