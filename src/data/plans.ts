// Care plans, add-ons, service rates, travel and the quote estimate.
// Prices are MARKET-based and set to compete (research of NYC and US 2026 pricing, owner's call
// 2026-11-01): each line says what it rests on, and docs/pricing.md lists the sources. The two
// lines still carrying the example marker had no usable market data.

// Plans: service contracts in the trade run 8-20% of the installed system's value a year, most often
// 8-12%. EZTek prices at the low end of that band (typical buildings: $15k, $30k, $45k+ installed).
export const PLANS = {
  essential: { name: 'Essential', price: 99, from: false, blurb: 'A service partner on file, with portal access and a yearly checkup.' }, // MARKET: ~8% a year of a $15k system
  priority: { name: 'Priority', price: 229, from: false, blurb: 'Faster dispatch and twice-a-year maintenance for buildings people live and work in.' }, // MARKET: ~9% a year of a $30k system
  managed: { name: 'Managed', price: 490, from: true, blurb: 'We watch the systems, cover labor on repairs and report to the owner or board.' }, // MARKET: ~13% a year of a $45k+ system, labor included
} as const;
export type PlanId = keyof typeof PLANS;

export const PLAN_ROWS: [string, string, string, string][] = [ // MARKET: tiers as in integrator service contracts (yearly, twice-yearly, quarterly visits)
  ['Client portal and service history', '✓', '✓', '✓'],
  ['Remote troubleshooting', '✓', '✓', '✓'],
  ['Preventive maintenance visits', '1 per year', '2 per year', '4 per year'],
  ['Dispatch target', 'Scheduled', 'Next business day', 'Same day, incl. after-hours'], // PLACEHOLDER: an operational promise only EZTek can set
  ['Firmware and security updates', '—', '✓', '✓'],
  ['Remote programming changes', 'Billed per change', '10 per month', 'Unlimited'],
  ['Labor on covered repairs', '10% off', '20% off', 'Included'],
  ['Travel charge', 'Standard', 'Waived', 'Waived'],
  ['Device health monitoring', 'Add-on', 'Add-on', 'Included'],
  ['Owner or board report', '—', 'Yearly', 'Quarterly'],
  ['Account manager', '—', '—', 'Dedicated'],
];

export const ADDONS = [
  { name: 'Extended cloud video retention', unit: 'camera', price: 4, desc: 'Keep 90 days of footage instead of 30.' }, // MARKET: full cloud video runs $7-20 per camera a month; retention only is less
  { name: 'Device health monitoring', unit: 'device', price: 2, desc: 'Alerts when a camera, reader or access point goes offline. Included in Managed.' }, // MARKET: $1-5 per device a month
  { name: 'After-hours coverage', unit: 'site', price: 120, desc: 'Evening, weekend and holiday dispatch. Included in Managed.' }, // PLACEHOLDER: no market data found
  { name: 'Managed Wi-Fi', unit: 'access point', price: 6, desc: 'Firmware, channel planning and monthly reports.' }, // MARKET: managed Wi-Fi services $5-10 per access point a month
];

// One-time service without a plan. MARKET: published NYC rates are $150/hour with a $375 minimum
// (Idesco) and $175/hour flat (a Brooklyn installer on Thumbtack); EZTek undercuts both and bills
// travel separately by distance, so nearby Brooklyn buildings pay no travel at all.
export const SERVICE_CALL = { firstHour: 149, hourly: 125, afterHoursMultiplier: 1.5 };

// Travel per visit, from the office in Bensonhurst (company.geo) to the building. Road miles are
// the straight-line distance x 1.35 (NYC street grid and bridges). No charge inside the free radius,
// then per road mile, capped inside the five boroughs. Waived on Priority and Managed plans; the
// free site survey never carries it. MARKET: NYC installers publish no trip fees (they quote it);
// this charges about a third of the technician's actual driving time, to stay attractive.
export const TRAVEL = { freeMiles: 6, perMile: 4, nycCap: 95, roadFactor: 1.35 };
export function travelFee(roadMiles: number, inNyc: boolean): number {
  const fee = Math.max(0, roadMiles - TRAVEL.freeMiles) * TRAVEL.perMile;
  return Math.round((inNyc ? Math.min(fee, TRAVEL.nycCap) : fee) / 5) * 5;
}

// Ballpark ranges for the quote wizard, installed price in USD, equipment and labor, before tax.
// MARKET: national 2026 ranges for New York City labor and access, held a little under the
// midpoint so the first number a visitor sees is competitive. Travel is added by address.
// per: what the count field multiplies; base: fixed part per project
export const ESTIMATE: Record<string, { base: [number, number]; per?: { field: 'units' | 'doors' | 'cams' | 'floors'; range: [number, number] } }> = {
  'video-surveillance': { base: [1200, 3000], per: { field: 'cams', range: [450, 900] } }, // camera $150-600 + new Cat6 drop $150-300 + mounting; recorder and setup in base
  'access-control': { base: [1200, 2800], per: { field: 'doors', range: [1800, 3600] } }, // $1.5-3.5k per door card/mobile, NYC single door $3-6k incl. controller
  'alarm-systems': { base: [1200, 2800], per: { field: 'doors', range: [150, 300] } }, // business systems $1.5-3k installed; contacts and motion per opening
  'intercom-entry': { base: [4500, 8500], per: { field: 'units', range: [40, 220] } }, // cloud video intercom $5-7k+ installed; app-only units low, in-unit stations high
  'audio-video': { base: [1800, 4500], per: { field: 'units', range: [1500, 5500] } }, // whole-home audio $1.5-4k a room; conference rooms $7-20k
  'networking-cabling': { base: [1200, 3000], per: { field: 'floors', range: [1500, 4000] } }, // Cat6 $150-300 a drop, about 10-15 drops a floor; rack, switch and firewall in base
  'building-automation': { base: [2200, 5500], per: { field: 'units', range: [900, 2800] } }, // lighting control $100-600 a control point, 4-6 points and a keypad a room
  'system-integration': { base: [4500, 14000] }, // whole-home lighting and control projects start near $10k; weak sources, the survey decides
  'maintenance-support': { base: [0, 0] },
};
