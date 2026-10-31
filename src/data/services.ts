// Service pages. `group` ties a service to a system in the hero building section.
// Copy describes the work in general terms; no client names, counts or prices here.

export type Faq = { q: string; a: string };
export type Service = {
  slug: string; group: string; icon: string; name: string; short: string; seo: string;
  desc: string; intro: string; includes: string[]; signs: string[]; deliver: string[]; faqs: Faq[];
  fit: string[];
};

export const SERVICES: Service[] = [
  {
    slug: 'video-surveillance', group: 'security', icon: 'video', name: 'Video surveillance', short: 'Cameras',
    seo: 'Security camera installation in NYC',
    desc: 'IP cameras, recorders and cloud video for entrances, lobbies, garages and stores.',
    intro: 'We plan camera positions from the incidents you want to resolve, not from a camera count. Every lens is aimed and tested from the recorder, and you can pull footage from your phone the same day.',
    includes: ['Site survey with a camera coverage plan', 'IP cameras, NVRs and cloud video', 'License plate and people-counting cameras', 'Remote viewing on phone and desktop', 'Upgrades from analog and DVR systems', 'Footage export for police and insurance'],
    signs: ['Footage is too blurry to identify a face', 'The recorder is full or nobody knows the password', 'Cameras go offline and nobody notices for weeks', 'You still use analog cameras and a DVR'],
    deliver: ['Camera map with fields of view', 'Labeled cabling and as-built drawing', 'User accounts and phone app set up', 'Recording retention set to your policy'],
    faqs: [
      { q: 'Can you reuse our existing cameras or cabling?', a: 'Often, yes. Coax can carry IP cameras with adapters, and many recorders accept newer cameras. We test what is there during the survey and tell you what to keep.' },
      { q: 'How long is footage kept?', a: 'Usually 30 days on site, or longer with cloud retention. We size the storage to the period you need.' },
      { q: 'Do you install cameras in apartment buildings with tenants in place?', a: 'Yes. Most work is in common areas and we schedule noisy work during the day with notice to residents.' },
    ],
    fit: ['multifamily', 'condo', 'office', 'retail', 'institution'],
  },
  {
    slug: 'access-control', group: 'security', icon: 'access', name: 'Access control', short: 'Access',
    seo: 'Access control and key fob systems in NYC',
    desc: 'Card, fob, PIN and mobile credentials for doors, gates, elevators and garages.',
    intro: 'Stop re-keying locks. We install readers, locks and controllers so you can add or remove a person in seconds and see who opened which door.',
    includes: ['Fob, card, PIN and phone credentials', 'Cloud-managed and on-site systems', 'Electric strikes, maglocks and exit devices', 'Elevator and garage access', 'Tenant move-in and move-out programming', 'Door audit reports'],
    signs: ['Keys and fobs of former tenants still work', 'Changing a code means a site visit', 'You cannot tell who entered after hours', 'Doors are propped open and nobody knows'],
    deliver: ['Door schedule and wiring diagram', 'Admin accounts for your staff', 'Credential import from the old system', 'Training for the super or office manager'],
    faqs: [
      { q: 'Can residents open the door with their phone?', a: 'Yes. Most current systems support mobile credentials alongside fobs, so residents can use either.' },
      { q: 'What happens in a power outage?', a: 'Controllers and locks run on backup batteries, and every door has a code-compliant way out. We design fail-safe or fail-secure by door.' },
      { q: 'Do you program fobs for new tenants?', a: 'Yes, remotely in most systems. Care plan clients order fobs in the portal and we drop them off programmed.' },
    ],
    fit: ['multifamily', 'condo', 'office', 'institution'],
  },
  {
    slug: 'alarm-systems', group: 'security', icon: 'alarm', name: 'Alarm & intrusion', short: 'Alarms',
    seo: 'Burglar alarm installation and monitoring in NYC',
    desc: 'Intrusion detection, panic buttons and alarm monitoring for homes and businesses.',
    intro: 'Door contacts, motion and glass-break sensors connected to a panel you can arm from your phone, with central-station monitoring when you want it.',
    includes: ['Wired and wireless intrusion sensors', 'Panic and hold-up buttons', 'Phone arming and alerts', 'Central-station monitoring setup', 'Integration with cameras for verified alarms', 'Takeover of existing panels'],
    signs: ['False alarms you have learned to ignore', 'An old keypad nobody knows how to use', 'No alerts when the store opens late', 'A monitoring contract you pay for and do not use'],
    deliver: ['Zone list and sensor map', 'User codes set up', 'Monitoring contacts and call list', 'Test signals sent and logged'],
    faqs: [
      { q: 'Do I have to sign a monitoring contract?', a: 'No. You can self-monitor through the app or add professional monitoring. We will explain both.' },
      { q: 'Can you take over the system another company installed?', a: 'Usually, yes, if the panel is not locked by the previous installer. We check that during the survey.' },
    ],
    fit: ['residence', 'retail', 'office'],
  },
  {
    slug: 'intercom-entry', group: 'intercom', icon: 'intercom', name: 'Intercom & entry', short: 'Intercom',
    seo: 'Video intercom installation for NYC apartment buildings',
    desc: 'Video intercoms, telephone entry and smartphone entry for lobbies and gates.',
    intro: 'Replace the buzzer that half the building ignores. Residents see the visitor on their phone and open the door from anywhere, and couriers get a code that works only for them.',
    includes: ['Video intercom panels for lobbies and gates', 'Smartphone entry with no apartment wiring', 'Apartment stations and handsets', 'Delivery and courier codes', 'Directory management online', 'Upgrades of old audio intercoms'],
    signs: ['Visitors cannot reach the tenant they want', 'Packages pile up because couriers cannot get in', 'Handsets in apartments are broken or missing', 'The panel shows names of people who left years ago'],
    deliver: ['Resident directory loaded', 'Resident app invitations sent', 'Instructions posted in the lobby', 'Admin access for the managing agent'],
    faqs: [
      { q: 'Do residents need new wiring in their apartments?', a: 'Not with smartphone-based entry. If residents want an in-unit station, we can reuse existing intercom wiring in most buildings.' },
      { q: 'Is there a monthly fee?', a: 'Cloud intercoms usually have a per-building or per-unit service fee from the manufacturer. We show it in the proposal next to the install price.' },
    ],
    fit: ['multifamily', 'condo', 'office'],
  },
  {
    slug: 'audio-video', group: 'av', icon: 'av', name: 'Audio & video', short: 'Audio-video',
    seo: 'Home theater and commercial AV installation in NYC',
    desc: 'Home theaters, conference rooms, distributed audio and video walls.',
    intro: 'Rooms that work on the first try. We design, install and program theaters, conference rooms and multi-room audio so one button does what people expect.',
    includes: ['Home theaters and media rooms', 'Conference rooms and video conferencing', 'Distributed audio by zone', 'Video walls and digital signage', 'TV mounting with hidden cables', 'Calibration of picture and sound'],
    signs: ['Every meeting starts with ten minutes of cables', 'Five remotes for one TV', 'Music plays in one room only', 'Screens in the lobby still show last year'],
    deliver: ['Rack elevation and wiring diagram', 'Programmed remotes or touch panels', 'Room guides at each location', 'Calibration report'],
    faqs: [
      { q: 'Can you work with our architect or designer?', a: 'Yes. We provide speaker and screen layouts, backing and conduit requirements early so walls are built once.' },
      { q: 'Do you support Zoom Rooms and Microsoft Teams Rooms?', a: 'Yes. We install certified room kits and test calls before handover.' },
    ],
    fit: ['residence', 'office', 'retail', 'institution'],
  },
  {
    slug: 'networking-cabling', group: 'network', icon: 'network', name: 'Networks & cabling', short: 'Network',
    seo: 'Structured cabling, fiber and Wi-Fi installation in NYC',
    desc: 'Structured cabling, fiber optics, Wi-Fi, racks and phone systems.',
    intro: 'Every other system runs on the network. We pull, label and certify cabling, build the rack, and design Wi-Fi from a site survey instead of guesswork.',
    includes: ['Cat6/Cat6A cabling, tested and certified', 'Fiber optic backbones and risers', 'Wi-Fi surveys and installation', 'Racks, patch panels and cable management', 'Switches, firewalls and VLANs', 'VoIP phone systems'],
    signs: ['Wi-Fi drops in the same rooms every day', 'Nobody knows which cable goes where', 'The rack is a pile of patch cords', 'Moving an office desk takes a contractor visit'],
    deliver: ['Cable test reports for every drop', 'Port map and labeled patch panels', 'Wi-Fi heat map after installation', 'Network diagram and passwords handed over'],
    faqs: [
      { q: 'Do you work during off-hours?', a: 'Yes. Cutovers in offices and stores are usually scheduled at night or on weekends to avoid downtime.' },
      { q: 'Can you wire a new office before move-in?', a: 'Yes. We coordinate with the general contractor and finish cabling, Wi-Fi and phones before the first day.' },
    ],
    fit: ['office', 'multifamily', 'condo', 'residence', 'retail', 'institution'],
  },
  {
    slug: 'building-automation', group: 'automation', icon: 'automation', name: 'Building automation', short: 'Automation',
    seo: 'Lighting control, motorized shades and smart home automation in NYC',
    desc: 'Lighting control, motorized shades, HVAC integration and schedules.',
    intro: 'Lights, shades and climate that follow the time of day and the people in the room. We keep it simple to use and easy to change later.',
    includes: ['Lighting control and scenes', 'Motorized shades and drapery', 'Thermostat and HVAC integration', 'Occupancy and daylight sensors', 'Energy schedules for common areas', 'Keypads that make sense'],
    signs: ['Hallway lights on all night', 'Shades nobody can reach', 'Every thermostat set differently', 'A smart home that only one person can use'],
    deliver: ['Scene list agreed with you', 'Engraved keypads', 'Schedules set for the season', 'App access for each household member'],
    faqs: [
      { q: 'Can automation be added to an existing home?', a: 'Yes. Wireless lighting and shade systems need little or no new wiring and can be installed room by room.' },
      { q: 'Will it save energy in common areas?', a: 'Schedules and occupancy sensors usually cut runtime of lights and HVAC in hallways and amenity rooms. We show the settings so you can adjust them.' },
    ],
    fit: ['residence', 'office', 'condo', 'institution'],
  },
  {
    slug: 'system-integration', group: 'integration', icon: 'integration', name: 'System integration', short: 'Integration',
    seo: 'Control4 and system integration in NYC',
    desc: 'One control platform for lights, shades, AV, cameras, access and climate.',
    intro: 'Separate systems become one. We program control processors and touch panels so the door, cameras, music, lights and climate answer to one app.',
    includes: ['Control processors and touch panels', 'One app for every system', 'Custom scenes and automations', 'Integration of existing equipment', 'Remote access and updates', 'Documentation of every rule'],
    signs: ['Six apps to run one home', 'Systems from different installers that ignore each other', 'A programmer who no longer answers', 'Scenes that broke after an update'],
    deliver: ['Program backup stored in your portal', 'List of scenes and automations', 'Touch panels and app set up', 'Training for each user'],
    faqs: [
      { q: 'Can you take over programming from another integrator?', a: 'If the project files are available or the system is not dealer-locked, yes. If not, we rebuild the program and document it for you.' },
      { q: 'Who owns the program?', a: 'You do. We keep a backup in your portal so you are never locked to one dealer.' },
    ],
    fit: ['residence', 'office', 'condo'],
  },
  {
    slug: 'maintenance-support', group: 'maintenance', icon: 'maintenance', name: 'Maintenance & support', short: 'Service',
    seo: 'Low-voltage service and maintenance contracts in NYC',
    desc: 'Repairs, preventive maintenance, upgrades and remote support on care plans.',
    intro: 'Most problems are cheaper to prevent than to fix. Care plans give you scheduled inspections, monitoring and faster dispatch, and every request is tracked in the portal.',
    includes: ['Troubleshooting and repairs', 'Preventive maintenance visits with reports', 'Firmware and security updates', 'Device health monitoring', 'Remote programming changes', 'Service of systems we did not install'],
    signs: ['You find out a camera is down after an incident', 'Every repair starts with finding a vendor', 'No record of what was fixed and when', 'Firmware has never been updated'],
    deliver: ['Written report after every visit', 'Request history in the portal', 'Device list with warranty dates', 'Board or owner summary'],
    faqs: [
      { q: 'Do I need a plan to request a repair?', a: 'No. Anyone can book a service call. Plan clients get faster dispatch, lower labor rates and included visits.' },
      { q: 'Will you service equipment another company installed?', a: 'Yes, after a takeover inspection where we test it and document what needs attention.' },
    ],
    fit: ['multifamily', 'condo', 'office', 'retail', 'institution', 'residence'],
  },
];

export const serviceBySlug = Object.fromEntries(SERVICES.map((s) => [s.slug, s]));

// Systems shown in the building section of the hero
export const GROUPS = [
  { id: 'security', name: 'Security', cap: 'Cameras at the entrance, halls and cellar, plus a card reader at the lobby door.' },
  { id: 'intercom', name: 'Intercom', cap: 'Entry panel at the lobby door and stations in each apartment and the residence.' },
  { id: 'av', name: 'Audio-video', cap: 'Theater screen in the penthouse, a conference display and ceiling speakers on the office floor.' },
  { id: 'network', name: 'Network', cap: 'Fiber from the street to the cellar rack, up the riser to Wi-Fi on every floor.' },
  { id: 'automation', name: 'Automation', cap: 'Motorized shades and lighting in the residence, a smart thermostat in the office.' },
  { id: 'integration', name: 'Integration', cap: 'One controller in the cellar ties every system to a single touch panel upstairs.' },
  { id: 'maintenance', name: 'Service', cap: 'Every device has a status. Here, one lobby camera is offline and a request is already open.' },
];
