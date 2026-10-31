See the project brief maintained in the claude.ai Project "Eztek" (claude/eztek-site-task.md). Key points:

- Company facts: 1707 70th St, Brooklyn, NY 11204; (888) 693-9835; eztekav.com; founded 2000 (owner, 2026-10-31).
- Segments by NYC occupancy group: R-2 rentals, R-2 condos/co-ops, R-3 residences, B offices, M / A-2 retail and hospitality, E schools and institutions.
- Care plans (DRAFT): Essential $149, Priority $349, Managed from $790 per building per month.
- Missing facts are filled with example data marked PLACEHOLDER (owner's decision 2026-10-31); `npm run check:launch` lists them.
- Production: marketing site is static (Astro, done in Phase 2 step 1); the client portal needs auth, a database, payments and a link to EZTek's dispatch/CRM tool.
- DNS: never change MX/TXT. Cutover: only A @ and CNAME www, with owner approval.

## Still needed from the owner
- Which tool EZTek uses for jobs, dispatch and invoices (QuickBooks, ServiceTitan, Jobber, none). Decides build vs connect for the portal.
- Email inbox for leads, then a Web3Forms key for it.
- Hours, emergency policy, license number, insurance limits, real stats and Google rating.
- Logo files, install photos, team names and photos, brands EZTek is authorized for.
- Real care plan prices and terms; quote estimate ranges.
- 2-3 real projects and client quotes with written permission.
- eztek.us: separate site or redirect to eztekav.com.

## Ideas queued for later
- QR sticker on every installed device that opens a service request for that device.
- Russian, Chinese and Spanish versions of key pages.
- Recurring services: cloud video retention, remote monitoring, access control as a service.
- Referral credit for supers and property managers.
