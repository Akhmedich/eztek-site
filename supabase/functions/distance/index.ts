// Road distance from the EZTek office to a building, for the travel charge on quotes, service calls
// and proposals. Geocodes with the free US Census geocoder (no key) and estimates road miles as the
// straight-line distance x 1.35. The site turns miles into dollars (src/data/plans.ts, TRAVEL).
// Deploy with verify_jwt off: the site calls it with the publishable key; it checks the origin.
// Also returns the coordinates, used to send jobs to the nearest pros.
// POST { address } -> { miles, in_nyc, matched, lat, lng } | { miles: null }
const ORIGINS = (Deno.env.get('ASSISTANT_ORIGINS') ?? 'https://akhmedich.github.io,https://eztekav.com,https://www.eztekav.com,http://localhost:4321')
  .split(',').map((o) => o.trim()).filter(Boolean);
const OFFICE = { lat: 40.6176, lng: -73.9952 }; // 1707 70th St, Brooklyn (src/data/company.ts)
const ROAD_FACTOR = 1.35;
const NYC_COUNTIES = new Set(['36005', '36047', '36061', '36081', '36085']); // Bronx, Kings, New York, Queens, Richmond

const miles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};

// Same address, same answer: a small cache saves the Census service repeated lookups
const cache = new Map<string, unknown>();

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST' || !ORIGINS.includes(origin)) return json({ error: 'forbidden' }, 403);

  let address = '';
  try { address = String((await req.json()).address ?? '').trim(); } catch { /* bad body */ }
  if (address.length < 8 || address.length > 200) return json({ miles: null });
  const key = address.toLowerCase().replace(/\s+/g, ' ');
  if (cache.has(key)) return json(cache.get(key));

  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
    for (const [k, v] of Object.entries({ address, benchmark: 'Public_AR_Current', vintage: 'Current_Current', layers: 'Counties', format: 'json' })) url.searchParams.set(k, v);
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const m = (await r.json())?.result?.addressMatches?.[0];
    if (!m) return json({ miles: null });
    const county = m.geographies?.Counties?.[0];
    const out = {
      miles: Math.round(miles(OFFICE, { lat: m.coordinates.y, lng: m.coordinates.x }) * ROAD_FACTOR * 10) / 10,
      in_nyc: !!county && NYC_COUNTIES.has(`${county.STATE}${county.COUNTY}`),
      matched: m.matchedAddress,
      lat: m.coordinates.y,
      lng: m.coordinates.x,
    };
    if (cache.size > 2000) cache.clear();
    cache.set(key, out);
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ miles: null });
  }
});
