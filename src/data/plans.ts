// Care plans, add-ons and the quote estimate. All prices are PLACEHOLDER drafts.

export const PLANS = {
  essential: { name: 'Essential', price: 149, from: false, blurb: 'A service partner on file, with portal access and a yearly checkup.' }, // PLACEHOLDER
  priority: { name: 'Priority', price: 349, from: false, blurb: 'Faster dispatch and twice-a-year maintenance for buildings people live and work in.' }, // PLACEHOLDER
  managed: { name: 'Managed', price: 790, from: true, blurb: 'We watch the systems, cover labor on repairs and report to the owner or board.' }, // PLACEHOLDER
} as const;
export type PlanId = keyof typeof PLANS;

export const PLAN_ROWS: [string, string, string, string][] = [ // PLACEHOLDER
  ['Client portal and service history', '✓', '✓', '✓'],
  ['Remote troubleshooting', '✓', '✓', '✓'],
  ['Preventive maintenance visits', '1 per year', '2 per year', '4 per year'],
  ['Dispatch target', 'Scheduled', 'Next business day', 'Same day, incl. after-hours'],
  ['Firmware and security updates', '—', '✓', '✓'],
  ['Remote programming changes', 'Billed per change', '10 per month', 'Unlimited'],
  ['Labor on covered repairs', '10% off', '20% off', 'Included'],
  ['Device health monitoring', 'Add-on', 'Add-on', 'Included'],
  ['Owner or board report', '—', 'Yearly', 'Quarterly'],
  ['Account manager', '—', '—', 'Dedicated'],
];

export const ADDONS = [ // PLACEHOLDER
  { name: 'Extended cloud video retention', unit: 'camera', price: 3, desc: 'Keep 90 days of footage instead of 30.' },
  { name: 'Device health monitoring', unit: 'device', price: 2, desc: 'Alerts when a camera, reader or access point goes offline. Included in Managed.' },
  { name: 'After-hours coverage', unit: 'site', price: 120, desc: 'Evening, weekend and holiday dispatch. Included in Managed.' },
  { name: 'Managed Wi-Fi', unit: 'access point', price: 4, desc: 'Firmware, channel planning and monthly reports.' },
];

// Ballpark ranges for the quote wizard, installed price in USD. PLACEHOLDER
// per: what the count field multiplies; base: fixed part per project
export const ESTIMATE: Record<string, { base: [number, number]; per?: { field: 'units' | 'doors' | 'cams' | 'floors'; range: [number, number] } }> = {
  'video-surveillance': { base: [1500, 3000], per: { field: 'cams', range: [450, 900] } },
  'access-control': { base: [1200, 2500], per: { field: 'doors', range: [1800, 3500] } },
  'alarm-systems': { base: [900, 1800], per: { field: 'doors', range: [150, 300] } },
  'intercom-entry': { base: [4000, 8500], per: { field: 'units', range: [60, 220] } },
  'audio-video': { base: [3500, 9000], per: { field: 'units', range: [1200, 4500] } },
  'networking-cabling': { base: [1500, 3500], per: { field: 'floors', range: [1800, 4200] } },
  'building-automation': { base: [3000, 7500], per: { field: 'units', range: [900, 2600] } },
  'system-integration': { base: [3500, 9000] },
  'maintenance-support': { base: [0, 0] },
};
