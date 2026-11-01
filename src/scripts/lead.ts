// Sends a lead two ways, each optional:
// 1. Supabase `leads` table (system of record for the dashboard and Claude):
//    PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY. The anon key can only insert leads,
//    and attach files to a lead it just added (private bucket lead-files, staff read them).
// 2. Email to the team through Web3Forms: PUBLIC_FORM_ENDPOINT, PUBLIC_FORM_KEY.
//    Several keys separated by commas send a copy to each form's recipient.
// With neither set (preview), nothing leaves the browser and the form says so.

const SB_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const MAIL_URL = import.meta.env.PUBLIC_FORM_ENDPOINT as string | undefined;
const MAIL_KEYS = String(import.meta.env.PUBLIC_FORM_KEY ?? '').split(',').map((k) => k.trim()).filter(Boolean);
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

// crypto.randomUUID is missing on iOS before 15.4
function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Form fields that have their own column in `leads`; anything else goes into message
const COLUMNS = ['urgency', 'name', 'company', 'role', 'email', 'phone', 'address', 'borough', 'building', 'systems', 'project', 'timing', 'size', 'care_plan', 'survey_window', 'estimate'];

function toRow(kind: string, id: string, fields: Record<string, string>, extra: Record<string, string> = {}) {
  // the browser picks the row id so it can attach files to the lead without reading it back
  const row: Record<string, unknown> = { id: uuid(), ref: id, kind, source: { ...source(), page: location.pathname, ...extra } };
  const lines: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    if (COLUMNS.includes(k)) row[k] = v.slice(0, 500);
    else if (k === 'message') lines.unshift(v);
    else lines.push(`${k.replace(/_/g, ' ')}: ${v}`);
  }
  if (lines.length) row.message = lines.join('\n').slice(0, 5000);
  return row;
}

async function toDb(row: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: { apikey: SB_KEY!, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`db ${r.status}`);
}

// Photos and plans: images are shrunk to 2000 px JPEG first (phone photos are 3-8 MB)
export const FILE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
export const MAX_FILES = 10;
export const MAX_FILE_MB = 10;
export const canAttach = !!(SB_URL && SB_KEY); // files go only to Supabase, never by email
// Windows browsers often give HEIC photos no type; the bucket only takes known types
const typeOf = (f: File) => f.type || (/\.hei[cf]$/i.test(f.name) ? 'image/heic' : /\.pdf$/i.test(f.name) ? 'application/pdf' : '');

async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 600_000) return file;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85));
    return out && out.size < file.size ? out : file;
  } catch { return file; } // e.g. HEIC outside Safari: send as is
}

async function toFiles(leadId: string, files: File[]): Promise<string[]> {
  const sent: string[] = [];
  for (const [i, f] of files.slice(0, MAX_FILES).entries()) {
    const blob = await shrink(f);
    const base = f.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'file';
    const ext = blob.type === 'image/jpeg' ? 'jpg' : (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const r = await fetch(`${SB_URL}/storage/v1/object/lead-files/${leadId}/${i + 1}-${base}.${ext}`, {
      method: 'POST',
      headers: { apikey: SB_KEY!, 'Content-Type': blob.type || typeOf(f), 'x-upsert': 'false' },
      body: blob,
    }).catch(() => null);
    if (r?.ok) sent.push(f.name);
  }
  return sent;
}

async function toMail(key: string | undefined, label: string, id: string, fields: Record<string, string>) {
  const r = await fetch(MAIL_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      ...(key ? { access_key: key } : {}),
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

export type LeadResult = { ok: boolean; id: string; preview: boolean; error?: string; filesFailed?: number };

// kind: quote | service | contact | partner; label goes into the email subject;
// extra is added to the lead's source (for example the QR sticker id);
// files are attached to the lead in Supabase, and the email lists their names
export async function sendLead(kind: string, label: string, prefix: string, fields: Record<string, string>, honeypot = '', extra: Record<string, string> = {}, files: File[] = []): Promise<LeadResult> {
  const id = refId(prefix);
  if (honeypot) return { ok: true, id, preview: false }; // bots get a quiet success
  const row = toRow(kind, id, fields, extra);
  if (!(SB_URL && SB_KEY) && !MAIL_URL) {
    console.info('[preview] lead not sent', row, files.map((f) => f.name));
    return { ok: true, id, preview: true };
  }
  let sent: string[] = [];
  const db = SB_URL && SB_KEY ? toDb(row).then(async () => { if (files.length) sent = await toFiles(row.id as string, files); }) : null;
  // with files, the email waits for the uploads so it can say which ones arrived
  if (files.length) await db?.catch(() => {});
  const mailFields = files.length ? { ...fields, files: sent.length ? `${sent.length} in EZTek Ops: ${sent.join(', ')}` : `${files.length} could not be uploaded` } : fields;
  const jobs: Promise<void>[] = db ? [db] : [];
  if (MAIL_URL) (MAIL_KEYS.length ? MAIL_KEYS : [undefined]).forEach((k) => jobs.push(toMail(k, label, id, mailFields)));
  // one working channel is enough: the lead is not lost
  const res = await Promise.allSettled(jobs);
  const ok = res.some((r) => r.status === 'fulfilled');
  const error = res.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => String(r.reason)).join('; ');
  return { ok, id, preview: false, error: error || undefined, filesFailed: files.length - sent.length || undefined };
}
