// Takes the deposit on an accepted proposal: returns a Stripe Checkout URL. Stripe shows the
// payment methods turned on in its dashboard (card, ACH bank account) and issues an invoice,
// which stripe-webhook mirrors into the client's invoices.
// One deposit, one checkout: an open session is handed out again (two tabs, Back from Stripe, a
// second click), and a bank payment on its way blocks a new one, so the client cannot pay twice.
// Called from the client's proposal page (/p/?t=<token>) without sign-in, so deploy with
// verify_jwt off: the proposal's secret token is the authorization.
// POST { token } -> { url } | { error }
import { stripe, admin, cors, json, customerFor, PORTAL_URL } from '../_shared/billing.ts';

const PROPOSAL_PAGE = new URL('../p/', PORTAL_URL.replace(/\/?$/, '/')).href;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { token } = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(token ?? '')) return json({ error: 'This link is not valid.' }, 400);
    if (!Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'offline' }, 503);

    const db = admin();
    const { data: p } = await db.from('proposals')
      .select('id,number,org_id,status,accepted_option,options,deposit_amount,deposit_status,checkout_session_id')
      .eq('token', token).maybeSingle();
    if (p?.deposit_status === 'processing') return json({ error: 'Your bank payment is on its way. You do not need to pay again.' }, 409);
    if (!p || p.status !== 'accepted' || p.deposit_status !== 'pending' || !p.org_id || !(Number(p.deposit_amount) > 0)) {
      return json({ error: 'There is no deposit to pay on this proposal.' }, 400);
    }
    if (p.checkout_session_id) {
      const prev = await stripe.checkout.sessions.retrieve(p.checkout_session_id);
      if (prev.status === 'open' && prev.url) return json({ url: prev.url });
      if (prev.status === 'complete') return json({ error: 'This deposit is already being processed.' }, 409);
    }

    const option = (p.options as { key: string; name: string }[]).find((o) => o.key === p.accepted_option);
    const meta = { proposal_id: p.id };
    const s = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: await customerFor(p.org_id),
      line_items: [{
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: Math.round(Number(p.deposit_amount) * 100), product_data: { name: `Deposit · ${p.number}${option ? ' · ' + option.name : ''}` } },
      }],
      invoice_creation: { enabled: true, invoice_data: { description: `Deposit for proposal ${p.number}`, metadata: meta } },
      payment_intent_data: { metadata: meta },
      metadata: meta,
      success_url: `${PROPOSAL_PAGE}?t=${token}&paid=1`,
      cancel_url: `${PROPOSAL_PAGE}?t=${token}`,
    }, { idempotencyKey: `deposit-${p.id}-${p.checkout_session_id ?? 'first'}` }); // two clicks at once get one session
    const { error } = await db.from('proposals').update({ checkout_session_id: s.id }).eq('id', p.id);
    if (error) throw error;
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return json({ error: 'Payment is not available right now.' }, 500);
  }
});
