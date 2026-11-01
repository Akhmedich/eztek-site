// Leads from marketplaces and other channels (Thumbtack, Angi, Yelp, Google Local Services, email
// parsers) through their official lead webhooks or a Zapier/Make step. Each lead lands in the
// dashboard like a website request, with the channel in `source`; one lead is stored once.
// Deploy with verify_jwt off; the caller sends the shared secret INTAKE_SECRET in x-intake-secret.
// POST { channel, id?, name, phone?, email?, address?, borough?, service?, message?, urgent? }
//   -> { ok, lead } | { error }
import { admin, cors, json } from '../_shared/billing.ts';

const SECRET = Deno.env.get('INTAKE_SECRET');
const clip = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SECRET || req.headers.get('x-intake-secret') !== SECRET) return json({ error: 'Not allowed.' }, 401);
  try {
    const b = await req.json();
    const channel = clip(b.channel, 40)?.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const name = clip(b.name, 200);
    if (!channel || !name) return json({ error: 'channel and name are required.' }, 400);
    if (!clip(b.phone, 50) && !clip(b.email, 200)) return json({ error: 'A phone or an email is required.' }, 400);
    const externalId = clip(b.id, 120);

    const urgent = b.urgent === true || b.urgent === 'true' || b.urgent === 'yes';
    const db = admin();
    if (externalId) {
      const { data: seen } = await db.from('leads').select('id').eq('source->>channel', channel).eq('source->>external_id', externalId).maybeSingle();
      if (seen) return json({ ok: true, lead: seen.id, duplicate: true });
    }
    const { data, error } = await db.from('leads').insert({
      ref: `MK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      kind: urgent ? 'service' : 'quote',
      urgency: urgent ? 'urgent' : null,
      name,
      phone: clip(b.phone, 50),
      email: clip(b.email, 200),
      address: clip(b.address, 300),
      borough: clip(b.borough, 50),
      systems: clip(b.service, 500),
      message: clip(b.message, 5000),
      source: { channel, ...(externalId ? { external_id: externalId } : {}), utm_source: channel },
    }).select('id').single();
    if (error?.code === '23505') return json({ ok: true, duplicate: true }); // the same lead, sent twice at once
    if (error) throw error;
    return json({ ok: true, lead: data.id });
  } catch (e) {
    console.error(e);
    return json({ error: 'Could not save the lead.' }, 500);
  }
});
