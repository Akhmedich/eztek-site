import type { Faq } from './services';

export type Building = {
  slug: string; name: string; code: string; who: string; seo: string; intro: string;
  needs: string[]; services: string[]; plan: 'essential' | 'priority' | 'managed'; faqs: Faq[];
};

// `code` is the usual NYC occupancy group; the certificate of occupancy has the exact one
export const BUILDINGS: Building[] = [
  {
    slug: 'multifamily', name: 'Rental apartments', code: 'R-2', plan: 'priority',
    seo: 'Intercom, cameras and access control for NYC rental buildings',
    who: 'Owners, managing agents and supers of walk-ups, elevator buildings and new developments.',
    intro: 'Tenants judge a building by the front door. We keep entry, cameras and fobs working, handle move-ins and move-outs, and give the super one number to call.',
    needs: ['Lobby entry that works with phones, not only buzzers', 'Cameras covering entrances, mailrooms and laundry', 'Fob changes when tenants move in and out', 'One vendor to call when something stops working'],
    services: ['intercom-entry', 'video-surveillance', 'access-control', 'networking-cabling', 'maintenance-support'],
    faqs: [
      { q: 'Can you work around tenants?', a: 'Yes. Common-area work is scheduled during the day with notices posted in advance. In-unit work is booked with each tenant.' },
      { q: 'Can the super manage fobs?', a: 'Yes. The super gets an account limited to your building, and every change is logged.' },
    ],
  },
  {
    slug: 'condo', name: 'Condos & co-ops', code: 'R-2', plan: 'managed',
    seo: 'Security and entry systems for NYC condos and co-ops',
    who: 'Boards, managing agents and resident managers.',
    intro: 'Boards want fewer complaints and clear reports. We plan upgrades around residents, document everything and send a summary the board can read in five minutes.',
    needs: ['Video entry and package access for residents', 'Reports the board can read in five minutes', 'A current certificate of insurance on file', 'Upgrades planned around residents, with notice'],
    services: ['intercom-entry', 'access-control', 'video-surveillance', 'networking-cabling', 'maintenance-support'],
    faqs: [
      { q: 'Can you present to the board?', a: 'Yes. We bring a short proposal with options and prices and answer questions at the meeting.' },
      { q: 'Do you provide COIs for the managing agent?', a: 'Yes, naming the building, the corporation and the agent. Plan clients request them in the portal.' },
    ],
  },
  {
    slug: 'residence', name: 'Private residences', code: 'R-3', plan: 'managed',
    seo: 'Home theater, smart home and security for NYC homes',
    who: 'Homeowners, townhouse and penthouse owners, architects and designers.',
    intro: 'A home that runs from one app and does not need a manual. We work with your architect from drawings and stay on call after you move in.',
    needs: ['A theater and whole-home audio run from one remote', 'Shades and lighting scenes by room and time of day', 'Whole-home Wi-Fi on a wired backbone', 'One app for door, cameras and climate'],
    services: ['audio-video', 'building-automation', 'networking-cabling', 'system-integration', 'alarm-systems'],
    faqs: [
      { q: 'When should we bring you in during a renovation?', a: 'Before walls close: ideally at design development, so wiring, backing and conduit go in once.' },
      { q: 'Do you offer support after installation?', a: 'Yes. Managed plans include monitoring, updates and priority visits.' },
    ],
  },
  {
    slug: 'office', name: 'Offices & commercial', code: 'B', plan: 'priority',
    seo: 'Office cabling, Wi-Fi, access control and AV in NYC',
    who: 'Office managers, facility teams, landlords and general contractors.',
    intro: 'Move-in day with working Wi-Fi, badges and conference rooms. We coordinate with your GC and IT, then handle moves, adds and changes.',
    needs: ['Cabling and Wi-Fi ready on move-in day', 'Badge access you can manage remotely', 'Conference rooms that connect on the first try', 'Moves, adds and changes without downtime'],
    services: ['networking-cabling', 'access-control', 'audio-video', 'video-surveillance', 'system-integration'],
    faqs: [
      { q: 'Do you work with general contractors?', a: 'Yes. We price from drawings, attend coordination meetings and close out with as-builts and test reports.' },
      { q: 'Can you work after hours?', a: 'Yes. Cutovers and noisy work are scheduled at night or on weekends.' },
    ],
  },
  {
    slug: 'retail', name: 'Retail & hospitality', code: 'M / A-2', plan: 'essential',
    seo: 'Cameras, music and Wi-Fi for NYC stores and restaurants',
    who: 'Stores, restaurants, hotels and gyms.',
    intro: 'Watch the register from your phone, play the right music in each zone and keep guest Wi-Fi away from your payment network.',
    needs: ['Cameras on registers, stockrooms and doors', 'Background music and screens by zone', 'Guest Wi-Fi kept apart from the business network', 'Alarm you can arm and check from your phone'],
    services: ['video-surveillance', 'alarm-systems', 'audio-video', 'networking-cabling', 'maintenance-support'],
    faqs: [
      { q: 'Can you install before opening?', a: 'Yes. Tell us the opening date and we schedule backwards from it.' },
      { q: 'Do you install in more than one location?', a: 'Yes, with the same layout and one account for every store.' },
    ],
  },
  {
    slug: 'institution', name: 'Schools & institutions', code: 'E', plan: 'managed',
    seo: 'Security, PA and network systems for NYC schools and institutions',
    who: 'Schools and colleges, plus houses of worship, nonprofits and clinics.',
    intro: 'Controlled entry, clear audio in every room and documentation ready for audits and grant reports.',
    needs: ['Controlled entry and visitor check-in', 'Public address and classroom AV', 'Network and Wi-Fi across the whole campus', 'Documentation for audits and grant reports'],
    services: ['access-control', 'video-surveillance', 'intercom-entry', 'networking-cabling', 'audio-video'],
    faqs: [
      { q: 'Can you work during school breaks?', a: 'Yes. Large installations are usually planned for summer and holidays.' },
      { q: 'Do you help with security grant paperwork?', a: 'We provide equipment lists, quotes and documentation in the format the grant asks for.' },
    ],
  },
];

export const buildingBySlug = Object.fromEntries(BUILDINGS.map((b) => [b.slug, b]));
