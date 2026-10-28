/** Gera src/lib/generated/paths.ts a partir do openapi.json do backend. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(resolve(here, '../../backend-nest/openapi.json'), 'utf8'));

const constName = (path) =>
  path
    .split('/')
    .filter(Boolean)
    .map((s) => (s.startsWith('{') ? `by_${s.slice(1, -1)}` : s))
    .join('_')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();

const entries = Object.keys(spec.paths)
  .sort()
  .map((path) => {
    const params = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    const name = constName(path);
    if (params.length === 0) return `  ${name}: '${path}',`;
    const args = params.map((p) => `${p}: string`).join(', ');
    const tpl = path.replace(/\{([^}]+)\}/g, (_, p) => `\${encodeURIComponent(${p})}`);
    return `  ${name}: (${args}) => \`${tpl}\`,`;
  });

const dupes = entries
  .map((e) => e.trim().split(':')[0])
  .filter((n, i, a) => a.indexOf(n) !== i);
if (dupes.length) throw new Error(`Nomes duplicados em paths.ts: ${dupes.join(', ')}`);

const out = `/**
 * Gerado por scripts/generate-api-paths.mjs a partir de backend-nest/openapi.json.
 * Do not edit manually.
 */
export const API_PATHS = {
${entries.join('\n')}
} as const;
`;

writeFileSync(resolve(here, '../src/lib/generated/paths.ts'), out);
console.log(`paths.ts: ${entries.length} rotas`);
