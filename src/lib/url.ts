import { company } from '../data/company';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Site path with the deploy base, and a trailing slash on page paths
export function u(path = '/'): string {
  const m = path.match(/^([^?#]*)(.*)$/)!;
  let p = m[1] || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return BASE + p + m[2];
}

export const tel = `tel:${company.phone}`;
export const sms = `sms:${company.phone}`;

export function money(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
