// Sends a lead two ways, each optional:
// 1. Supabase `leads` table (system of record for the dashboard and Claude):
//    PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY. The anon key can only insert leads.
// 2. Email to the team through Web3Forms: PUBLIC_FORM_ENDPOINT, PUBLIC_FORM_KEY.
// With neither set (preview), nothing leaves the browser and the form says so.

const SB_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const MAIL_URL = import.meta.env.PUBLIC_FORM_ENDPOINT as string | undefined;
const MAIL_KEY = import.meta.env.PUBLIC_FORM_KEY as string | undefined;
const SRC_KEY = 'ez-source';

// First-touch attribution: where this visitor came from, kept for the session
export function rememberSource() {
  try {
    if (sessionStorage.getItem(SRC_KEY)) return;
    const q = new URLSearchParams(location.search);
    const src: Record<string, string> = { landing: location.pathname, referrer: document.referrer || 'direct' };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'gclid'].forEach((k) => { const v = q.get(k); if (v) src[k] = v; });
    sessionStorage.setItem(SRC_KEY, JSON.stringify(src));
  } catch { /* storage blocked */ }
}

function source(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(SRC_KEY) || '{}'); } catch { return {}; }
}

export function refId(prefix: string) {
  const d = new Date();
  return `${prefix}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Form fields that have their own column in `leads`; anything else goes into message
const COLUMNS = ['urgency', 'name', 'company', 'role', 'email', 'phone', 'address', 'borough', 'building', 'systems', 'project', 'timing', 'size', 'care_plan', 'survey_window', 'estimate'];

function toRow(kind: string, id: string, fields: Record<string, string>) {
  const row: Record<string, unknown> = { ref: id, kind, source: { ...source(), page: location.pathname } };
  const extra: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    if (COLUMNS.includes(k)) row[k] = v.slice(0, 500);
    else if (k === 'message') extra.unshift(v);
    else extra.push(`${k.replace(/_/g, ' ')}: ${v}`);
  }
  if (extra.length) row.message = extra.join('\n').slice(0, 5000);
  return row;
}

async function toDb(row: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`db ${r.status}`);
}

async function toMail(label: string, id: string, fields: Record<string, string>) {
  const r = await fetch(MAIL_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      ...(MAIL_KEY ? { access_key: MAIL_KEY } : {}),
      subject: `[${label}] ${id} ${fields.name || ''}`.trim(),
      from_name: 'eztekav.com',
      reference: id,
      ...fields,
      ...Object.fromEntries(Object.entries(source()).map(([k, v]) => [`source_${k}`, v])),
      page: location.href,
    }),
  });
  if (!r.ok) throw new Error(`mail ${r.status}`);
}

export type LeadResult = { ok: boolean; id: string; preview: boolean; error?: string };

// kind: quote | service | contact | partner; label goes into the email subject
export async function sendLead(kind: string, label: string, prefix: string, fields: Record<string, string>, honeypot = ''): Promise<LeadResult> {
  const id = refId(prefix);
  if (honeypot) return { ok: true, id, preview: false }; // bots get a quiet success
  const jobs: Promise<void>[] = [];
  if (SB_URL && SB_KEY) jobs.push(toDb(toRow(kind, id, fields)));
  if (MAIL_URL) jobs.push(toMail(label, id, fields));
  if (!jobs.length) {
    console.info('[preview] lead not sent', toRow(kind, id, fields));
    return { ok: true, id, preview: true };
  }
  // one working channel is enough: the lead is not lost
  const res = await Promise.allSettled(jobs);
  const ok = res.some((r) => r.status === 'fulfilled');
  const error = res.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => String(r.reason)).join('; ');
  return { ok, id, preview: false, error: error || undefined };
}
