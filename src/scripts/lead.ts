// Sends a lead to the form service. Without PUBLIC_FORM_ENDPOINT (preview), nothing leaves
// the browser and the form shows its success state marked as a preview.
// Web3Forms: PUBLIC_FORM_ENDPOINT=https://api.web3forms.com/submit, PUBLIC_FORM_KEY=<access key>

const ENDPOINT = import.meta.env.PUBLIC_FORM_ENDPOINT as string | undefined;
const KEY = import.meta.env.PUBLIC_FORM_KEY as string | undefined;
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

export type LeadResult = { ok: boolean; id: string; preview: boolean; error?: string };

export async function sendLead(kind: string, prefix: string, fields: Record<string, string>, honeypot = ''): Promise<LeadResult> {
  const id = refId(prefix);
  if (honeypot) return { ok: true, id, preview: false }; // bots get a quiet success
  const payload = {
    ...(KEY ? { access_key: KEY } : {}),
    subject: `[${kind}] ${id} ${fields.name || ''}`.trim(),
    from_name: 'eztekav.com',
    reference: id,
    kind,
    ...fields,
    ...Object.fromEntries(Object.entries(source()).map(([k, v]) => [`source_${k}`, v])),
    page: location.href,
  };
  if (!ENDPOINT) {
    console.info('[preview] lead not sent', payload);
    return { ok: true, id, preview: true };
  }
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { ok: true, id, preview: false };
  } catch (e) {
    return { ok: false, id, preview: false, error: String(e) };
  }
}
