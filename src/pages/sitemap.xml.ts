import type { APIRoute } from 'astro';
import { SERVICES } from '../data/services';
import { BUILDINGS } from '../data/buildings';
import { AREAS } from '../data/areas';
import { u } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/', '/services/', '/buildings/', '/areas/', '/care-plans/', '/quote/', '/service/', '/about/', '/contact/', '/partners/', '/join/', '/portal/', '/privacy/', '/terms/',
    ...SERVICES.map((s) => `/services/${s.slug}/`),
    ...BUILDINGS.map((b) => `/buildings/${b.slug}/`),
    ...AREAS.map((a) => `/areas/${a.slug}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${new URL(u(p), site).href}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
