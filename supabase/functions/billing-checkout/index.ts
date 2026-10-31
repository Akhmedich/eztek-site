// Starts a care plan subscription for one building: returns a Stripe Checkout URL.
// If the building already has a subscription, returns the Stripe billing portal instead,
// where the plan can be changed or canceled.
// POST { site_id, plan: 'essential' | 'priority' }
import { stripe, PRICES, PORTAL_URL, asCaller, admin, cors, json, billingAccess, customerFor } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { site_id, plan } = await req.json();
    const price = PRICES[plan];
    if (!price) return json({ error: 'This plan is set up by EZTek. Request it and we will call you.' }, 400);

    // reading through the caller's session proves they can see this building
    const { data: site } = await asCaller(req).from('sites').select('id,org_id,name,stripe_subscription_id').eq('id', site_id).maybeSingle();
    if (!site) return json({ error: 'Building not found.' }, 404);
    const denied = await billingAccess(req, site.org_id);
    if (denied) return json({ error: denied }, 403);

    const customer = await customerFor(site.org_id);
    if (site.stripe_subscription_id) {
      const s = await stripe.billingPortal.sessions.create({ customer, return_url: PORTAL_URL + '#billing' });
      return json({ url: s.url });
    }

    const meta = { site_id: site.id, org_id: site.org_id, plan };
    const s = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: site.id,
      metadata: meta,
      subscription_data: { metadata: meta, description: `Care plan · ${site.name}` },
      success_url: PORTAL_URL + '?billing=success#billing',
      cancel_url: PORTAL_URL + '?billing=canceled#billing',
    });
    await admin().from('sites').update({ plan_status: 'pending' }).eq('id', site.id).eq('plan_status', 'none');
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return json({ error: 'Billing is not available right now.' }, 500);
  }
});
