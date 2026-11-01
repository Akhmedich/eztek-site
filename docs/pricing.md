# Prices: where they come from

Set 2026-11-01 at the owner's request: market-based prices instead of examples, set to compete (at or under the market midpoint), with travel charged by distance from the office. Placeholders only where no data exists. Values live in `src/data/plans.ts`, each with a one-line basis. These are researched market rates, not quotes EZTek has given; Mansur should check them against real jobs and change any that do not match how EZTek works.

Most sources are vendor guides and installer forums, not audited market data, so ranges were taken toward the upper end for New York City labor and building access.

## Care plans (per building, per month)
Basis: service contracts in the security and AV integration trade cost 8-20% of the installed system's value per year, most often 8-12% ([learncctv](https://learncctv.com/?p=6007), [IPVM](https://ipvm.com/discussions/how-much-do-you-charge-for-a-service-maintenace-package), [Zigaflow](https://zigaflow.com/industry-resources/service-contract-maintenance-management-av-systems-integrators)). Small businesses pay roughly $50-300 a month for monitoring and service ([Safe and Sound](https://getsafeandsound.com/blog/remote-video-monitoring-service-cost/)).

| Plan | Price | Reasoning |
|---|---|---|
| Essential | $99 | ~8% a year of a $15k installed system: the low end of the 8-12% norm |
| Priority | $229 | ~9% a year of a $30k system; travel waived |
| Managed | from $490 | ~13% a year of a $45k+ system; labor included, travel waived |

## Service call without a plan
$149 for the first hour on site, then $125 an hour, parts extra; 1.5x after hours, plus travel by distance. Published NYC rates are $150 an hour with a $375 minimum ([Idesco](https://www.idesco.com/schedule_call.htm)) and $175 an hour flat for a Brooklyn installer ([Thumbtack](https://www.thumbtack.com/ny/brooklyn/handyman/unipros-security/service/491586780619431945)).

## Travel by distance
From the office at 1707 70th St (geocoded with the [US Census geocoder](https://geocoding.geo.census.gov/)). Road miles = straight line x 1.35. Free up to 6 road miles, then $4 per road mile per visit, capped at $95 inside the five boroughs; outside NYC no cap. Waived on Priority and Managed; the site survey is always free. NYC installers publish no trip fees, so this was set to charge about a third of the technician's driving time.

| From Bensonhurst to | Road mi | Travel |
|---|---|---|
| Bay Ridge, Park Slope | 3-5 | $0 |
| Williamsburg | 9 | $10 |
| Midtown Manhattan | 13 | $25 |
| Astoria | 15 | $35 |
| Fordham, Riverdale (Bronx) | 24-26 | $70-80 |
| Hempstead (Nassau) | 28 | $90 |

Known limit: across water (Staten Island, New Jersey) the straight line is shorter than the drive, so those trips come out cheap. Staff can add a travel line by hand in a proposal.

## Quote wizard ranges (installed, equipment and labor)
| System | Basis |
|---|---|
| Cameras | $150-300 per new Cat6 camera drop, $150-500 per camera installed, higher in the Northeast ([BTI](https://www.btigroup.com/post/professional-security-camera-installation-costs/), [ButterflyMX NYC](https://butterflymx.com/blog/security-camera-installation-nyc/), [Safe and Sound](https://getsafeandsound.com/blog/cctv-camera-installation-cost/)) |
| Access control | $1.5-3.5k per door for card or mobile, NYC single door $3-6k ([Safe and Sound](https://getsafeandsound.com/blog/access-control-systems-cost/), [Kisi](https://www.getkisi.com/blog/breakdown-of-access-control-system-installation-costs)) |
| Intercom | $5-30k for most multifamily systems; ButterflyMX $30-42 per unit a year in software ([Swiftlane](https://www.swiftlane.com/blog/how-much-does-a-video-intercom-system-cost-in-2026-complete-pricing-guide/), [ButterflyMX](https://butterflymx.com/cost/)) |
| Alarm | $1.5-3k for a business system installed ([Safe and Sound](https://getsafeandsound.com/blog/business-alarm-systems-pricing/), [BTI](https://www.btigroup.com/post/commercial-alarm-system-pricing/)) |
| Network cabling | $150-300 per Cat6 drop, $200-400 Cat6A ([Unio](https://unio.digital/blog/structured-cabling-cost-per-drop), [DataWire](https://datawiresolutions.com/blog/network-cabling-cost)) |
| Audio-video | $1.5-4k per room of whole-home audio; $7-20k per 6-12 person conference room ([Ideal Automation](https://www.myidealav.com/whole-home-audio-phoenix), [Vibe](https://vibe.us/blog/conference-room-av-cost-guide/)) |
| Building automation | $100-600 per lighting control point; shades $570-2,850 a window ([latestcost](https://latestcost.com/lutron-lighting-system-cost-product-tier-installation-scope/)) |
| System integration | whole-home control projects start near $10k; weak sources, the survey decides |

## Still placeholders
- Dispatch targets per plan: an operational promise only EZTek can set.
- After-hours coverage add-on ($120/site/mo): no market data found.
- Everything in `src/data/company.ts` and `src/data/proof.ts` (hours, license, ratings, sample projects): facts about EZTek itself, not researchable.

## Before taking deposits
New York's home improvement rules (General Business Law, Article 36-A) can require deposits on residential contracts to go into escrow or be bonded. Check with EZTek's lawyer before the proposal step takes deposits from homeowners.
