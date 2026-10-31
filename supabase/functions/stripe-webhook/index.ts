// Keeps the database in step with Stripe: care plan status per building and the invoice list.
// Stripe endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted,
// invoice.finalized, invoice.paid, invoice.payment_failed, invoice.voided, invoice.marked_uncollectible
import Stripe from 'npm:stripe@22.6.2';
import { stripe, admin, planForPrice } from '../_shared/billing.ts';

const crypto = Stripe.createSubtleCryptoProvider();
const STATUS: Record<string, string> = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', incomplete: 'pending', canceled: 'canceled', incomplete_expired: 'canceled', paused: 'past_due' };

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
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode !== 'subscription' || !s.metadata?.site_id) break;
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
