import type { APIRoute } from 'astro';
import { PREVIEW } from '../data/company';
import { u } from '../lib/url';

// Preview blocks all crawlers. Note: on GitHub Pages this file sits under /eztek-site/,
// where crawlers do not read it; the noindex meta tag is what keeps the preview out.
export const GET: APIRoute = ({ site }) => {
  const body = PREVIEW
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL(u('/sitemap.xml'), site).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
