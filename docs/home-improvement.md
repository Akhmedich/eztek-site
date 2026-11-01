# Residential jobs: New York home improvement rules

Researched 2026-11-01 at the owner's request and built into proposals. This is a summary of public sources, not legal advice; have EZTek's lawyer read it once.

## What the law asks
For work on a residential building (houses, condos and co-ops, apartment buildings), New York's General Business Law § 771 requires a written contract signed by both sides ([§ 771](https://newyork.public.law/laws/n.y._general_business_law_section_771), [NY Attorney General](https://ag.ny.gov/home-improvement-fact-sheet)) that states:
- the contractor's name, address, phone and license number;
- approximate start and substantial-completion dates;
- the work and materials, with make and model, and the price;
- a payment schedule in dollars, payments in reasonable relation to the work;
- the mechanic's lien notice, in the statute's own words, in bold;
- that payments received before completion go into an escrow account at a New York bank within five business days (Lien Law § 71-a), or are guaranteed by a bond, contract of indemnity or letter of credit;
- the owner's right to cancel until midnight of the third business day after signing;
- the insurance covering the work (insurer, address, phone).

The owner gets a copy signed by the contractor before work starts. There is no cap on the deposit in New York; payments only have to bear a reasonable relationship to the work. A contract missing these terms can be unenforceable.

In New York City, residential work over $200 also needs a DCWP **Home Improvement Contractor license**, and so does every subcontractor ([DCWP](https://www.nyc.gov/site/dca/businesses/license-checklist-home-improvement-contractor.page)). Security and fire alarm work needs the NYS Department of State **Article 6-D installer license** ([DOS](https://dos.ny.gov/get-security-or-fire-alarm-installer-license)).

## What the site does now
- A proposal follows these rules automatically when the client is a homeowner or board, or the building is a house, condo/co-op or apartment building. Staff can override it in the editor.
- It cannot be sent without approximate dates. Sending signs it with the sender's name for EZTek.
- The client's page (`/p/`) shows all the terms above, the payment schedule in dollars, the lien notice word for word and the escrow notice; after signing, the exact cancellation deadline, a **Cancel** button that works until then, and **Print or save this contract**.
- Deadline: the end of the third weekday after signing, New York time. Holidays are not skipped, so the window is never shorter than the law's.
- A cancellation by the owner marks the proposal closed, cancels a pending deposit, and leaves a staff note to refund a paid one.
- **Online deposits on residential jobs are switched off** until escrow is in place: the page says EZTek will call to arrange the deposit. Commercial jobs are not affected.

## What EZTek needs to do (owner)
1. **Escrow account.** Open an account at a bank in New York State used only for customer deposits, or get a bond or letter of credit instead. If you use Stripe for deposits, make that escrow account the payout bank (or open a separate Stripe account for deposits that pays out to it); Stripe pays out within a few business days, inside the five-day rule.
2. **Turn on online deposits for residential jobs:** in Supabase > Edge Functions > Secrets add `HOME_IMPROVEMENT_ESCROW` = `on`, only after step 1.
3. **License and insurance on the contract:** fill in `hicLicense` (DCWP license number) and `insurer` (insurer name, address and phone) in `src/data/company.ts`, or ask Claude to. They show on residential contracts as soon as they are filled in.
4. Check that EZTek holds the DCWP Home Improvement Contractor license and the Article 6-D license, and that every technician who installs alarms is licensed or employed under them.
