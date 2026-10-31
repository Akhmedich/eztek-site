// Launch gate: lists every PLACEHOLDER line in src/ and fails while any is left
// or PREVIEW is still true. Run before pointing eztekav.com at this site.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const hits = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('PLACEHOLDER')) hits.push(`${relative(root, p)}:${i + 1}  ${line.trim().slice(0, 110)}`);
    });
  }
};
walk(root);
const preview = /export const PREVIEW = true/.test(readFileSync(join(root, 'data/company.ts'), 'utf8'));
console.log(hits.length ? `${hits.length} placeholder lines:\n${hits.join('\n')}` : 'No placeholders left.');
if (preview) console.log('PREVIEW is true in src/data/company.ts');
process.exit(hits.length || preview ? 1 : 0);
