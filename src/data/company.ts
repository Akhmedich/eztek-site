// Business facts in one place. Every line marked PLACEHOLDER is example data the owner
// asked for until the real value arrives (2026-10-31). `npm run check:launch` lists them
// and fails until none are left and PREVIEW is false.

export const PREVIEW = true; // false at launch: removes noindex and the preview strip

export const company = {
  name: 'EZTek Solutions',
  founded: 2000, // confirmed by the owner 2026-10-31
  phone: '+18886939835',
  phoneDisplay: '(888) 693-9835',
  smsEnabled: true, // PLACEHOLDER: confirm the number accepts texts
  email: 'info@eztekav.com', // PLACEHOLDER
  serviceEmail: 'service@eztekav.com', // PLACEHOLDER
  billingEmail: 'billing@eztekav.com', // PLACEHOLDER
  address: { street: '1707 70th St', city: 'Brooklyn', region: 'NY', zip: '11204', hood: 'Bensonhurst' },
  geo: { lat: 40.6156, lng: -73.9906 }, // PLACEHOLDER: approximate, check against Google Business Profile
  domain: 'eztekav.com',
  hours: [
    { days: 'Mon–Fri', time: '8:00 AM – 6:00 PM', spec: ['Mo', 'Tu', 'We', 'Th', 'Fr'], opens: '08:00', closes: '18:00' }, // PLACEHOLDER
    { days: 'Sat', time: '9:00 AM – 2:00 PM', spec: ['Sa'], opens: '09:00', closes: '14:00' }, // PLACEHOLDER
  ],
  emergency: 'Emergency dispatch 24/7 for care plan clients', // PLACEHOLDER
  license: 'NYS DOS Security & Fire Alarm Installer License #00-000000', // PLACEHOLDER
  insurance: '$2M general liability · $5M umbrella · workers comp', // PLACEHOLDER
  // Required on residential (home improvement) contracts, GBL § 771; shown on /p/ only when filled in
  hicLicense: '', // PLACEHOLDER: NYC DCWP Home Improvement Contractor license number
  insurer: '', // PLACEHOLDER: insurer of the policy covering the work, with its address and phone
  responseTime: '4 hours', // PLACEHOLDER: emergency on-site target for Managed plan
  callback: 'within one business hour', // PLACEHOLDER: how fast a new lead gets a call
  proposalDays: 3, // PLACEHOLDER: business days from survey to proposal
};

export const yearsInBusiness = new Date().getFullYear() - company.founded;

export const stats = [
  { v: `${company.founded}`, k: 'In business since' },
  { v: '1,200+', k: 'Buildings served' }, // PLACEHOLDER
  { v: '35,000+', k: 'Devices installed' }, // PLACEHOLDER
  { v: '98%', k: 'Plan renewals' }, // PLACEHOLDER
];

export const rating = { value: 4.9, count: 140, source: 'Google' }; // PLACEHOLDER

export const brands = [ // PLACEHOLDER: list only brands EZTek is authorized or certified for
  'Axis', 'Hanwha Vision', 'Avigilon', 'Hikvision', 'Brivo', 'Openpath', 'ButterflyMX', 'Aiphone',
  'Comelit', 'Control4', 'Lutron', 'Sonos', 'Ubiquiti', 'Cisco Meraki', 'Ruckus', 'Leviton',
];

export const credentials = [ // PLACEHOLDER
  { t: 'Licensed', d: 'NYS Department of State security and fire alarm installer license.' },
  { t: 'Insured', d: 'Certificates of insurance issued same day, naming your building and agent.' },
  { t: 'Certified', d: 'Technicians trained and certified by the manufacturers we install.' },
  { t: 'Background-checked', d: 'Every technician who enters an apartment is screened.' },
];
