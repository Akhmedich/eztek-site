export type Area = { slug: string; name: string; hoods: string[]; note: string; eta: string };

export const AREAS: Area[] = [
  {
    slug: 'brooklyn', name: 'Brooklyn', eta: 'Same day', // PLACEHOLDER: dispatch targets
    note: 'Our office is in Bensonhurst, so Brooklyn buildings get the shortest drive and the fastest dispatch.',
    hoods: ['Bensonhurst', 'Bay Ridge', 'Dyker Heights', 'Borough Park', 'Midwood', 'Sheepshead Bay', 'Brighton Beach', 'Gravesend', 'Park Slope', 'Williamsburg', 'Downtown Brooklyn', 'Crown Heights'],
  },
  {
    slug: 'manhattan', name: 'Manhattan', eta: 'Next business day', // PLACEHOLDER
    note: 'Condos, co-ops, offices and townhouses from the Financial District to Washington Heights.',
    hoods: ['Upper East Side', 'Upper West Side', 'Midtown', 'Chelsea', 'Tribeca', 'Financial District', 'Harlem', 'Washington Heights', 'Lower East Side', 'Murray Hill'],
  },
  {
    slug: 'queens', name: 'Queens', eta: 'Next business day', // PLACEHOLDER
    note: 'Apartment buildings, retail strips and offices across Queens.',
    hoods: ['Astoria', 'Long Island City', 'Forest Hills', 'Rego Park', 'Flushing', 'Jackson Heights', 'Bayside', 'Jamaica'],
  },
  {
    slug: 'staten-island', name: 'Staten Island', eta: 'Next business day', // PLACEHOLDER
    note: 'Homes, stores and multifamily buildings across the island, a short drive over the Verrazzano.',
    hoods: ['St. George', 'Tottenville', 'Great Kills', 'New Dorp', 'Todt Hill', 'Port Richmond'],
  },
  {
    slug: 'bronx', name: 'The Bronx', eta: 'Next business day', // PLACEHOLDER
    note: 'Elevator buildings, schools and institutions across the Bronx.',
    hoods: ['Riverdale', 'Fordham', 'Pelham Bay', 'Throgs Neck', 'Mott Haven', 'Parkchester'],
  },
];

export const areaBySlug = Object.fromEntries(AREAS.map((a) => [a.slug, a]));
export const METRO = ['Nassau County', 'Westchester', 'Northern New Jersey']; // PLACEHOLDER: confirm the metro coverage
