# Pro network: technicians and partner installers

Owner's idea (2026-11-01): open the site to owner-operators, contractors and hired technicians so they receive jobs through it, to grow both the flow of requests and EZTek's capacity. Researched and started the same day.

## What New York allows, and the model that follows
- **Employees by default.** New York's Construction Industry Fair Play Act presumes that anyone doing construction work for a contractor is an employee, unless they pass a three-part independent-contractor test or a 12-point "separate business entity" test that includes real capital investment beyond tools and a vehicle ([NYS DOL](https://dol.ny.gov/nys-construction-industry-fair-play-act)). Willful misclassification carries penalties. So individual technicians join as **W-2 employees**, not gig workers.
- **Licenses travel with the work.** Installing or servicing security and fire alarm systems needs the NYS Department of State Article 6-D license, for the business and the installers ([DOS](https://dos.ny.gov/get-security-or-fire-alarm-installer-license)). Residential work in NYC over $200 needs a DCWP Home Improvement Contractor license, and every subcontractor needs its own ([DCWP](https://www.nyc.gov/site/dca/businesses/license-checklist-home-improvement-contractor.page)).
- **EZTek stays the contractor.** The client signs with EZTek (the home improvement rules in `docs/home-improvement.md` apply to EZTek's contract), EZTek collects payment and gives the warranty. Partners are licensed, insured companies working as EZTek's subcontractors.

So the "marketplace" is a **managed partner network**: the site sells and runs the job, approved partners and employees do the work, and partners are paid per job through the site. This keeps the brand, the license and the warranty in one place, which is what property managers and boards pay for.

## Phases
1. **Sign-up and review (built).** `/join/`: technicians (W-2) and partner companies apply with trades, areas, licenses and insurance. Staff review them in `/admin/` > Pros: approve, pause, reject, notes. Approve a partner only after checking the alarm license on the DOS license search, the DCWP license for residential work, and a certificate of insurance naming EZTek.
2. **Jobs to partners.** Assign a job to an approved partner from the job card; the partner gets a link (like the client proposal link) with the scope, building, dates and the subcontract price, and accepts or declines. Status, photos and sign-off from the partner's page; the client keeps seeing EZTek.
3. **Payouts (Stripe Connect).** Each partner company opens a Stripe Express account from its link. The client pays EZTek as now; after EZTek signs the job off, the site transfers the partner's share to their account ("separate charges and transfers", so money moves only after the work is accepted). Stripe charges $2 per active partner per month plus 0.25% + $0.25 per payout ([Stripe](https://support.stripe.com/questions/monetizing-payments-with-stripe-connect)).
4. **More requests.** With more capacity: wider service areas, faster dispatch targets, and sending overflow leads to partners instead of turning them away.

## How the money splits (proposal for the owner)
- Equipment is bought and marked up by EZTek; the partner is paid for labor.
- **Partner share: 70% of the labor price** on the client's contract, EZTek keeps 30% for sales, the client contract and licenses, payment risk, warranty and the platform. Home-services platforms keep between a few percent (lead fees, HomeAdvisor's ~3-4% historic take) and 15-20% (commission models); a managed model that carries the contract, collections and warranty sits above that, as subcontracting margins do.
- Travel charged to the client by distance (`docs/pricing.md`) goes to whoever drives.
- Payout after sign-off, within 7 days; a share held back if the client reports a defect within 30 days.
These numbers are a starting point to agree with partners; nothing is paid automatically until phase 3.

## Still to decide (owner)
- Partner share and payout timing above.
- Whether EZTek supplies all equipment, or partners may supply their own at set prices.
- Insurance minimums for partners (for example $1M general liability, workers' comp, EZTek as additional insured).
- A written subcontract for partners (scope, warranty, non-solicitation of EZTek's clients); a lawyer should draft it before phase 2.
