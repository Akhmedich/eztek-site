// New demand from public records: NYC DOB NOW job filings (NYC Open Data, dataset w9ak-ipjd) for new
// buildings and large alterations, the buildings that will need cameras, access control and intercoms.
// They land in `prospects` for staff to reach out to; nobody is contacted automatically.
// The admin dashboard calls it when the Prospects tab opens (staff only, verify_jwt on); a filing is
// stored once, so calling it often is harmless.
// POST {} -> { added } | { error }
import { admin, asCaller, cors, json } from '../_shared/billing.ts';

const DATASET = 'https://data.cityofnewyork.us/resource/w9ak-ipjd.json';
const TYPES = ['New Building', 'ALT-CO - New Building with Existing Elements to Remain', 'Alteration CO'];
const MIN_COST = 250000;
const DAYS = 30;

type Filing = Record<string, string | undefined>;
const num = (s?: string) => (s && isFinite(Number(s)) ? Number(s) : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { data: staff } = await asCaller(req).rpc('is_staff');
    if (staff !== true) return json({ error: 'Staff only.' }, 403);

    const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
    const q = new URLSearchParams({
      $select: 'job_filing_number,filing_date,job_type,house_no,street_name,borough,owner_s_business_name,applicant_business_name,initial_cost,proposed_dwelling_units,latitude,longitude,job_description',
      $where: `filing_date >= '${since}' AND job_type in(${TYPES.map((t) => `'${t}'`).join(',')}) AND initial_cost::number >= ${MIN_COST}`,
      $order: 'filing_date DESC',
      $limit: '500',
    });
    const r = await fetch(`${DATASET}?${q}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`NYC Open Data answered ${r.status}`);
    const filings = (await r.json()) as Filing[];

    const rows = filings.filter((f) => f.job_filing_number).map((f) => ({
      source: 'nyc-dob',
      source_id: f.job_filing_number!,
      filed_on: f.filing_date?.slice(0, 10) ?? null,
      job_type: f.job_type ?? null,
      address: [f.house_no, f.street_name?.replace(/\s+/g, ' ')].filter(Boolean).join(' ') || null,
      borough: f.borough ?? null,
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
    return json({ added: data?.length ?? 0 });
  } catch (e) {
    console.error(e);
    return json({ error: 'Could not fetch new permits right now.' }, 500);
  }
});
