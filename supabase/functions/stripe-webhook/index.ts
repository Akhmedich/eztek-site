// Keeps the database in step with Stripe: care plan status per building and the invoice list.
// Stripe endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
// customer.subscription.updated, customer.subscription.deleted,
// invoice.finalized, invoice.paid, invoice.payment_failed, invoice.voided, invoice.marked_uncollectible
import Stripe from 'npm:stripe@22.6.2';
import { stripe, admin, planForPrice } from '../_shared/billing.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

const crypto = Stripe.createSubtleCryptoProvider();
const STATUS: Record<string, string> = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', incomplete: 'pending', canceled: 'canceled', incomplete_expired: 'canceled', paused: 'past_due' };

// Deposit on a proposal. A bank (ACH) payment completes unpaid (processing) and succeeds or fails
// days later. A database error throws, so Stripe retries the event.
async function deposit(db: SupabaseClient, type: string, s: Stripe.Checkout.Session) {
  const { data: p, error } = await db.from('proposals').select('id,job_id,number,deposit_amount,deposit_status,checkout_session_id').eq('id', s.metadata!.proposal_id).maybeSingle();
  if (error) throw error;
  if (!p) return;
  const set = async (deposit_status: string) => { const { error } = await db.from('proposals').update({ deposit_status }).eq('id', p.id); if (error) throw error; };
  const note = async (body: string, client_visible = false) => { const { error } = await db.from('notes').insert({ job_id: p.job_id, author_name: 'Stripe', client_visible, body }); if (error) throw error; };
  const usd = (cents: number | null) => `$${((cents ?? 0) / 100).toFixed(2)}`;
  if (type === 'checkout.session.async_payment_failed') {
    if (p.deposit_status !== 'processing') return;
    await set('pending');
    return note(`The bank payment for the ${p.number} deposit did not go through. The client can pay again from the proposal link.`, true);
  }
  if (s.payment_status !== 'paid') { if (p.deposit_status === 'pending') await set('processing'); return; }
  if (p.deposit_status === 'paid') {
    if (s.id === p.checkout_session_id) return; // the same payment reported again
    return note(`A second deposit payment of ${usd(s.amount_total)} came in for ${p.number} (Stripe ${s.id}). Refund it in Stripe.`);
  }
  const due = Math.round(Number(p.deposit_amount) * 100);
  if (s.amount_total !== due) return note(`A deposit payment of ${usd(s.amount_total)} came in for ${p.number}, but ${usd(due)} was due. Check it in Stripe (${s.id}).`);
  await set('paid');
  await note(`Deposit for ${p.number} received: ${usd(due)}. We will call to schedule the work.`, true);
}

Deno.serve(async (req) => {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('Stripe-Signature') ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', undefined, crypto);
  } catch (e) {
    return new Response(`Bad signature: ${e}`, { status: 400 });
  }
  const db = admin();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === 'payment' && s.metadata?.proposal_id) { await deposit(db, event.type, s); break; }
        if (event.type !== 'checkout.session.completed' || s.mode !== 'subscription' || !s.metadata?.site_id) break;
        await db.from('sites').update({
          stripe_subscription_id: String(s.subscription), plan: s.metadata.plan, plan_status: 'active', plan_since: new Date().toISOString().slice(0, 10),
        }).eq('id', s.metadata.site_id);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const gone = event.type === 'customer.subscription.deleted';
        const plan = planForPrice(sub.items.data[0]?.price?.id) ?? sub.metadata?.plan;
        const patch: Record<string, unknown> = { plan_status: gone ? 'canceled' : (STATUS[sub.status] ?? 'pending'), stripe_subscription_id: gone ? null : sub.id };
        if (gone) patch.plan = 'none'; else if (plan) patch.plan = plan;
        const q = db.from('sites').update(patch);
        await (sub.metadata?.site_id ? q.eq('id', sub.metadata.site_id) : q.eq('stripe_subscription_id', sub.id));
        break;
      }
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible': {
        const inv = event.data.object as Stripe.Invoice;
        const { data: org } = await db.from('organizations').select('id').eq('stripe_customer_id', String(inv.customer)).maybeSingle();
        if (!org) break; // a customer created outside EZTek Ops
        const subId = (inv as unknown as { subscription?: string }).subscription
          ?? (inv as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
        const { data: site } = subId ? await db.from('sites').select('id').eq('stripe_subscription_id', subId).maybeSingle() : { data: null };
        await db.from('invoices').upsert({
          stripe_invoice_id: inv.id,
          org_id: org.id,
          site_id: site?.id ?? null,
          number: inv.number,
          description: inv.description ?? inv.lines?.data?.[0]?.description ?? null,
          amount_due: (inv.amount_due ?? 0) / 100,
          amount_paid: (inv.amount_paid ?? 0) / 100,
          status: inv.status ?? 'open',
          due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
          hosted_url: inv.hosted_invoice_url,
          pdf_url: inv.invoice_pdf,
          created_at: new Date(inv.created * 1000).toISOString(),
        }, { onConflict: 'stripe_invoice_id' });
        break;
      }
    }
  } catch (e) {
    console.error(event.type, e);
    return new Response('Handler error', { status: 500 }); // Stripe retries
  }
  return new Response('ok');
});
