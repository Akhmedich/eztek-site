import { defineConfig } from 'astro/config';

// Preview runs on GitHub Pages under /eztek-site/. At launch on eztekav.com:
// SITE_URL=https://eztekav.com BASE_PATH=/ npm run build
export default defineConfig({
  site: process.env.SITE_URL || 'https://akhmedich.github.io',
  base: process.env.BASE_PATH || '/eztek-site',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
