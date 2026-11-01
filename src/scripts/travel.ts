// Travel charge for an address: road miles from the `distance` Supabase function, dollars from
// TRAVEL in src/data/plans.ts. Returns null when the address is not found or the site is not
// connected; then the travel charge is confirmed on the call.
import { travelFee } from '../data/plans';

const SB_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export type Travel = { miles: number; fee: number; inNyc: boolean; matched: string; lat: number; lng: number };

const seen = new Map<string, Promise<Travel | null>>();
export function travelFor(address: string): Promise<Travel | null> {
  const a = address.trim();
  if (!SB_URL || !SB_KEY || a.length < 8) return Promise.resolve(null);
  if (!seen.has(a)) {
    seen.set(a, fetch(`${SB_URL}/functions/v1/distance`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ address: a }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && typeof d.miles === 'number' ? { miles: d.miles, inNyc: !!d.in_nyc, matched: d.matched || a, fee: travelFee(d.miles, !!d.in_nyc), lat: d.lat, lng: d.lng } : null))
      .catch(() => null));
  }
  return seen.get(a)!;
}
