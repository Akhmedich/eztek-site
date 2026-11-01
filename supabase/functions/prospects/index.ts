// New demand from public records (NYC Open Data), for staff to reach out to; nobody is contacted
// automatically. Two sources:
// - nyc-dob: DOB NOW job filings (dataset w9ak-ipjd) for new buildings and large alterations, the
//   buildings that will need cameras, access control and intercoms. A filing is stored once.
// - nyc-hpd: apartment buildings with open HPD violations for a broken or missing intercom (dataset
//   wvxf-dwi5), one row per building, with the owner and managing agent from the building's HPD
//   registration (dataset feu5-w2e2). The count and the latest date refresh on every pull.
// The admin dashboard calls it when the Prospects tab opens (staff only, verify_jwt on); calling it
// often is harmless.
// POST {} -> { added, permits, intercoms, failed? } | { error }
import { admin, asCaller, cors, json } from '../_shared/billing.ts';

const OPEN_DATA = 'https://data.cityofnewyork.us/resource';
type Rec = Record<string, string | undefined>;
const num = (s?: string) => (s && isFinite(Number(s)) ? Number(s) : null);
const clean = (s?: string) => s?.replace(/\s+/g, ' ').trim() || null;
const titleCase = (s?: string) => clean(s)?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) ?? null;
const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function openData(dataset: string, params: Record<string, string>): Promise<Rec[]> {
  const r = await fetch(`${OPEN_DATA}/${dataset}.json?${new URLSearchParams(params)}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`NYC Open Data ${dataset} answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as Rec[];
}

// New buildings and alterations of $250k and up, filed in the last 30 days
async function permits(): Promise<number> {
  const TYPES = ['New Building', 'ALT-CO - New Building with Existing Elements to Remain', 'Alteration CO'];
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const filings = await openData('w9ak-ipjd', {
    $select: 'job_filing_number,filing_date,job_type,house_no,street_name,borough,owner_s_business_name,applicant_business_name,initial_cost,proposed_dwelling_units,latitude,longitude,job_description',
    $where: `filing_date >= '${since}' AND job_type in(${TYPES.map(quote).join(',')}) AND initial_cost::number >= 250000`,
    $order: 'filing_date DESC',
    $limit: '500',
  });
  const rows = filings.filter((f) => f.job_filing_number).map((f) => ({
    source: 'nyc-dob',
    source_id: f.job_filing_number!,
    filed_on: f.filing_date?.slice(0, 10) ?? null,
    job_type: f.job_type ?? null,
    address: [f.house_no, clean(f.street_name)].filter(Boolean).join(' ') || null,
    borough: titleCase(f.borough),
    lat: num(f.latitude),
    lng: num(f.longitude),
    owner_business: f.owner_s_business_name && !/^(not applicable|n\/?a|pr)$/i.test(f.owner_s_business_name.trim()) ? f.owner_s_business_name.trim() : null,
    applicant_business: f.applicant_business_name?.trim() || null,
    cost: num(f.initial_cost),
    units: num(f.proposed_dwelling_units),
    description: f.job_description?.slice(0, 2000) ?? null,
  }));
  const { data, error } = await admin().from('prospects')
    .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: true }).select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

// Owner and managing agent per HPD registration, in batches; a failure here leaves the names empty
async function contacts(registrations: string[]): Promise<Map<string, { owner?: string; agent?: string }>> {
  const out = new Map<string, { owner?: string; agent?: string }>();
  const person = (c: Rec) => clean([c.firstname, c.lastname].filter(Boolean).join(' '));
  for (let i = 0; i < registrations.length; i += 80) {
    const batch = registrations.slice(i, i + 80);
    try {
      const list = await openData('feu5-w2e2', {
        $where: `registrationid in(${batch.map(quote).join(',')}) AND type in('CorporateOwner','IndividualOwner','JointOwner','Agent')`,
        $limit: '2000',
      });
      for (const c of list) {
        const id = String(c.registrationid ?? '');
        if (!id) continue;
        const e = out.get(id) ?? {};
        const name = clean(c.corporationname) || person(c);
        if (!name) continue;
        if (c.type === 'Agent') e.agent ??= name;
        else if (c.type === 'CorporateOwner') e.owner = clean(c.corporationname) || e.owner;
        else e.owner ??= name;
        out.set(id, e);
      }
    } catch (e) {
      console.error(e);
    }
  }
  return out;
}

// Buildings with open intercom violations issued in the last 120 days
async function intercoms(): Promise<number> {
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const found = await openData('wvxf-dwi5', {
    $where: `violationstatus = 'Open' AND novissueddate >= '${since}' AND upper(novdescription) like '%INTERCOM%'`,
    $order: 'novissueddate DESC',
    $limit: '5000',
  });
  const byBuilding = new Map<string, Rec[]>();
  for (const v of found) {
    if (!v.buildingid) continue;
    byBuilding.set(v.buildingid, [...(byBuilding.get(v.buildingid) ?? []), v]);
  }
  if (!byBuilding.size) return 0;

  const regs = [...new Set([...byBuilding.values()].map((vs) => vs[0].registrationid).filter((r): r is string => !!r && r !== '0'))];
  const who = await contacts(regs);
  const rows = [...byBuilding.entries()].map(([building, vs]) => {
    const v = vs[0]; // the newest
    const c = who.get(v.registrationid ?? '') ?? {};
    const apts = [...new Set(vs.map((x) => clean(x.apartment)).filter(Boolean))].slice(0, 12);
    return {
      source: 'nyc-hpd',
      source_id: building,
      filed_on: v.novissueddate?.slice(0, 10) ?? null,
      job_type: 'HPD intercom violation',
      address: [clean(v.housenumber), clean(v.streetname)].filter(Boolean).join(' ') || null,
      borough: titleCase(v.boro ?? v.borough),
      lat: num(v.latitude),
      lng: num(v.longitude),
      owner_business: c.owner?.slice(0, 200) ?? null,
      agent: c.agent?.slice(0, 200) ?? null,
      violations: vs.length,
      description: [v.class ? `Class ${v.class}.` : '', clean(v.novdescription) ?? '', apts.length ? `Apartments: ${apts.join(', ')}.` : ''].filter(Boolean).join(' ').slice(0, 2000) || null,
    };
  });

  const db = admin();
  const { data: known, error: e1 } = await db.from('prospects').select('source_id').eq('source', 'nyc-hpd').in('source_id', rows.map((r) => r.source_id));
  if (e1) throw e1;
  const seen = new Set((known ?? []).map((k) => k.source_id));
  // status is not sent, so a building staff already handled keeps its status
  const { error } = await db.from('prospects').upsert(rows, { onConflict: 'source,source_id' });
  if (error) throw error;
  return rows.filter((r) => !seen.has(r.source_id)).length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { data: staff } = await asCaller(req).rpc('is_staff');
    if (staff !== true) return json({ error: 'Staff only.' }, 403);
    const [p, h] = await Promise.allSettled([permits(), intercoms()]);
    for (const r of [p, h]) if (r.status === 'rejected') console.error(r.reason);
    if (p.status === 'rejected' && h.status === 'rejected') throw new Error('both sources failed');
    const n = (r: PromiseSettledResult<number>) => (r.status === 'fulfilled' ? r.value : 0);
    const failed = [p.status === 'rejected' && 'permits', h.status === 'rejected' && 'intercoms'].filter(Boolean);
    return json({ added: n(p) + n(h), permits: n(p), intercoms: n(h), ...(failed.length ? { failed } : {}) });
  } catch (e) {
    console.error(e);
    return json({ error: 'Could not fetch public records right now.' }, 500);
  }
});
