// Gives a person portal access to a client organization and emails them a sign-in link.
// Staff can invite to any organization; client admins only to their own.
// POST { org_id, email, role: 'admin' | 'manager' | 'super' | 'billing' | 'viewer' }
import { admin, asCaller, cors, json, PORTAL_URL } from '../_shared/billing.ts';

const ROLES = ['admin', 'manager', 'super', 'billing', 'viewer'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { org_id, email, role = 'manager' } = await req.json();
    if (!/^\S+@\S+\.\S+$/.test(email ?? '') || !ROLES.includes(role)) return json({ error: 'Check the email and role.' }, 400);

    const caller = asCaller(req);
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Sign in first.' }, 401);
    const { data: staff } = await caller.from('staff').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle();
    if (!staff) {
      const { data: m } = await caller.from('org_members').select('role').eq('org_id', org_id).eq('user_id', user.id).maybeSingle();
      if (m?.role !== 'admin') return json({ error: 'Only account admins can invite users.' }, 403);
    }

    const db = admin();
    let { data: uid } = await db.rpc('user_id_by_email', { p_email: email });
    if (!uid) {
      const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: PORTAL_URL });
      if (error) return json({ error: error.message }, 400);
      uid = data.user.id;
    }
    const { error } = await db.from('org_members').upsert({ org_id, user_id: uid, role, email: email.toLowerCase() });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Could not invite right now.' }, 500);
  }
});
