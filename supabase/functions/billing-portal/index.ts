// Opens the Stripe billing portal for an organization: cards and bank accounts, invoices, plan changes.
// POST { org_id }
import { stripe, PORTAL_URL, cors, json, billingAccess, customerFor } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { org_id } = await req.json();
    const denied = await billingAccess(req, org_id);
    if (denied) return json({ error: denied }, 403);
    const s = await stripe.billingPortal.sessions.create({ customer: await customerFor(org_id), return_url: PORTAL_URL + '#billing' });
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return json({ error: 'Billing is not available right now.' }, 500);
  }
});
