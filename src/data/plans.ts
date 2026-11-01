// Care plans, add-ons, service rates and the quote estimate.
// Prices are MARKET-based (research of NYC and US 2026 pricing, owner's call 2026-11-01): each line
// says what it rests on, and docs/pricing.md lists the sources. The two lines still carrying the
// example marker had no usable market data and stay examples until the owner sets them.

// Plans are priced from the industry norm for service contracts, 8-20% of the installed system's
// value per year, applied to typical EZTek buildings (about $15k, $30k and $45k+ of installed systems).
export const PLANS = {
  essential: { name: 'Essential', price: 129, from: false, blurb: 'A service partner on file, with portal access and a yearly checkup.' }, // MARKET: ~10% of a $15k system a year
  priority: { name: 'Priority', price: 279, from: false, blurb: 'Faster dispatch and twice-a-year maintenance for buildings people live and work in.' }, // MARKET: ~11% of a $30k system a year
  managed: { name: 'Managed', price: 590, from: true, blurb: 'We watch the systems, cover labor on repairs and report to the owner or board.' }, // MARKET: ~16% of a $45k system a year, labor included
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
  ['Device health monitoring', 'Add-on', 'Add-on', 'Included'],
  ['Owner or board report', '—', 'Yearly', 'Quarterly'],
  ['Account manager', '—', '—', 'Dedicated'],
];

export const ADDONS = [
  { name: 'Extended cloud video retention', unit: 'camera', price: 5, desc: 'Keep 90 days of footage instead of 30.' }, // MARKET: cloud video runs $7-20 per camera a month in full; retention only is less
  { name: 'Device health monitoring', unit: 'device', price: 2, desc: 'Alerts when a camera, reader or access point goes offline. Included in Managed.' }, // MARKET: $1-5 per device a month
  { name: 'After-hours coverage', unit: 'site', price: 120, desc: 'Evening, weekend and holiday dispatch. Included in Managed.' }, // PLACEHOLDER: no market data found
  { name: 'Managed Wi-Fi', unit: 'access point', price: 8, desc: 'Firmware, channel planning and monthly reports.' }, // MARKET: managed Wi-Fi services $5-10 per access point a month
];

// One-time service for buildings without a plan. MARKET: a published NYC integrator rate is
// $150/hour with a $375 minimum (2.5 hours); a one-hour minimum with travel inside NYC is lower.
export const SERVICE_CALL = { firstHour: 195, hourly: 150, afterHoursMultiplier: 1.5 };

// Ballpark ranges for the quote wizard, installed price in USD, equipment and labor, before tax.
// MARKET: national 2026 ranges, taken toward the upper end for New York City labor and access.
// per: what the count field multiplies; base: fixed part per project
export const ESTIMATE: Record<string, { base: [number, number]; per?: { field: 'units' | 'doors' | 'cams' | 'floors'; range: [number, number] } }> = {
  'video-surveillance': { base: [1500, 3500], per: { field: 'cams', range: [500, 1000] } }, // camera $150-600 + new Cat6 drop $150-300 + mounting; recorder and setup in base
  'access-control': { base: [1500, 3000], per: { field: 'doors', range: [2000, 4000] } }, // $1.5-3.5k per door card/mobile, NYC single door $3-6k incl. controller
  'alarm-systems': { base: [1500, 3000], per: { field: 'doors', range: [150, 350] } }, // business systems $1.5-3k installed; contacts and motion per opening
  'intercom-entry': { base: [5000, 9000], per: { field: 'units', range: [40, 250] } }, // cloud video intercom $5-7k+ installed; app-only units low, in-unit stations high
  'audio-video': { base: [2000, 5000], per: { field: 'units', range: [1500, 6000] } }, // whole-home audio $1.5-4k a room; conference rooms $7-20k
  'networking-cabling': { base: [1500, 3500], per: { field: 'floors', range: [1500, 4500] } }, // Cat6 $150-300 a drop, about 10-15 drops a floor; rack, switch and firewall in base
  'building-automation': { base: [2500, 6000], per: { field: 'units', range: [1000, 3000] } }, // lighting control $100-600 a control point, 4-6 points and a keypad a room
  'system-integration': { base: [5000, 15000] }, // whole-home lighting and control projects start near $10k; weak sources, survey decides
  'maintenance-support': { base: [0, 0] },
};
