# Pro network: technicians and partner installers

Owner's idea (2026-11-01): open the site to owner-operators, contractors and hired technicians so they receive jobs through it, to grow both the flow of requests and EZTek's capacity. Researched and started the same day.

## What New York allows, and the model that follows
- **Employees by default.** New York's Construction Industry Fair Play Act presumes that anyone doing construction work for a contractor is an employee, unless they pass a three-part independent-contractor test or a 12-point "separate business entity" test that includes real capital investment beyond tools and a vehicle ([NYS DOL](https://dol.ny.gov/nys-construction-industry-fair-play-act)). Willful misclassification carries penalties. So individual technicians join as **W-2 employees**, not gig workers.
- **Licenses travel with the work.** Installing or servicing security and fire alarm systems needs the NYS Department of State Article 6-D license, for the business and the installers ([DOS](https://dos.ny.gov/get-security-or-fire-alarm-installer-license)). Residential work in NYC over $200 needs a DCWP Home Improvement Contractor license, and every subcontractor needs its own ([DCWP](https://www.nyc.gov/site/dca/businesses/license-checklist-home-improvement-contractor.page)).
- **EZTek stays the contractor.** The client signs with EZTek (the home improvement rules in `docs/home-improvement.md` apply to EZTek's contract), EZTek collects payment and gives the warranty. Partners are licensed, insured companies working as EZTek's subcontractors.

So the "marketplace" is a **managed partner network**: the site sells and runs the job, approved partners and employees do the work, and partners are paid per job through the site. This keeps the brand, the license and the warranty in one place, which is what property managers and boards pay for.

## Phases
1. **Sign-up and review (built).** `/join/`: technicians (W-2) and partner companies apply with trades, areas, licenses and insurance. Staff review them in `/admin/` > Pros: approve, pause, reject, notes. Approve a partner only after checking the alarm license on the DOS license search, the DCWP license for residential work, and a certificate of insurance naming EZTek.
2. **Jobs to the nearest pros (built).** On the job card, "Offer to the 3 nearest pros": the building is located once, and the job goes to approved pros who do that kind of work and whose radius (set on `/join/`) covers it, nearest first; staff text them their link. Each pro has one private link (`/pro/?t=…`): the job, area, distance and pay; the address and access notes only after they take it. The first to take it gets it and the other offers are withdrawn. The pro who took it can bring in helpers from the network, nearest first, who get it on their own link. The pro reports the work done; staff sign it off and send the client the review link. Partners sign the agreement on their link before taking jobs (`src/data/agreement.ts`).
3. **Payouts (Stripe Connect).** Each partner company opens a Stripe Express account from its link. The client pays EZTek as now; after EZTek signs the job off, the site transfers the partner's share to their account ("separate charges and transfers", so money moves only after the work is accepted). Stripe charges $2 per active partner per month plus 0.25% + $0.25 per payout ([Stripe](https://support.stripe.com/questions/monetizing-payments-with-stripe-connect)).
4. **More requests.** With more capacity: wider service areas, faster dispatch targets, and sending overflow leads to partners instead of turning them away.

## How the money splits (agreed by the owner 2026-11-01)
- Equipment is bought and marked up by EZTek; the partner is paid for labor.
- **Partner share: 70% of the labor price** on the client's contract, EZTek keeps 30% for sales, the client contract and licenses, payment risk, warranty and the platform. Home-services platforms keep between a few percent (lead fees, HomeAdvisor's ~3-4% historic take) and 15-20% (commission models); a managed model that carries the contract, collections and warranty sits above that, as subcontracting margins do.
- Travel charged to the client by distance (`docs/pricing.md`) goes to whoever drives.
- Payout after sign-off, within 7 days; on large jobs up to 10% held for 30 days; defects reported within 90 days are fixed free.
Nothing is paid automatically until phase 3; until then staff pay partners as usual.

## Partner agreement
Plain-language subcontract in ten points (`src/data/agreement.ts`), shown and signed by typing a name on the partner's link; the name and time are stored on the pro. It covers licenses and insurance ($1M general liability, workers' comp, EZTek additional insured), the 70/30 split, fixes, helpers, non-solicitation of clients for 12 months, independence and ending it. A New York lawyer should read it before partners take residential jobs.

## Ratings
Clients rate a finished job (1 to 5 stars, a few words) from the review link; the rating counts for every pro who worked on it and shows on their page. Reviews the client allows to be published replace the sample quotes on the home page.

## New demand
- **Marketplaces.** Thumbtack, Angi, Yelp and Google Local Services send leads through their own lead notifications; connect each with a Zapier or Make step that posts to the `intake` function (`docs/ops.md`). They arrive in the dashboard like website requests, with the channel.
- **Permits.** New buildings and large alterations filed with NYC Buildings arrive in the Prospects tab; staff reach out to the owner or the architect.
- Not done on purpose: scraping marketplaces or contacting people automatically. It breaks the sites' terms, and automated texts and calls without consent are illegal (TCPA).

## Still to decide (owner)
- Whether EZTek supplies all equipment, or partners may supply their own at set prices.
- Insurance minimums for partners (for example $1M general liability, workers' comp, EZTek as additional insured).
- A lawyer's review of the partner agreement before residential jobs.
