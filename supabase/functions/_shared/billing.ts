// Shared setup for the billing functions (Supabase Edge Functions, Deno).
// Secrets (supabase secrets set ...): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// STRIPE_PRICE_ESSENTIAL, STRIPE_PRICE_PRIORITY, PORTAL_URL.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import Stripe from 'npm:stripe@22.6.2';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() });

// Plans sold online. Managed is priced per building after a survey, so it is set up by staff in Stripe.
export const PRICES: Record<string, string | undefined> = {
  essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
  priority: Deno.env.get('STRIPE_PRICE_PRIORITY'),
};
export const planForPrice = (price?: string) => Object.entries(PRICES).find(([, p]) => p && p === price)?.[0];

export const PORTAL_URL = Deno.env.get('PORTAL_URL') ?? 'https://akhmedich.github.io/eztek-site/portal/';

export const admin = (): SupabaseClient => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Client acting as the signed-in caller, so row level security applies to every read
export const asCaller = (req: Request): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// The caller must be an admin or billing member of the organization (or EZTek staff)
export async function billingAccess(req: Request, orgId: string): Promise<string | null> {
  const db = asCaller(req);
  const { data: { user } } = await db.auth.getUser();
  if (!user) return 'Sign in first.';
  const { data: staff } = await db.from('staff').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (staff) return null;
  const { data: m } = await db.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle();
  if (!m || !['admin', 'billing'].includes(m.role)) return 'Only account admins and billing users can change billing.';
  return null;
}

// Stripe customer for an organization, created on first use
export async function customerFor(orgId: string): Promise<string> {
  const db = admin();
  const { data: org, error } = await db.from('organizations').select('id,name,billing_email,stripe_customer_id').eq('id', orgId).single();
  if (error || !org) throw new Error('Organization not found');
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const c = await stripe.customers.create({ name: org.name, email: org.billing_email ?? undefined, metadata: { org_id: org.id } });
  await db.from('organizations').update({ stripe_customer_id: c.id }).eq('id', org.id);
  return c.id;
}
