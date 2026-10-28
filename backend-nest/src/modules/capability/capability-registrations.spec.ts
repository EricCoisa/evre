import * as fs from 'fs';
import * as path from 'path';

/** Anti-typo: lê os *.capabilities.ts como texto e cruza os nomes usados em register, requires e resolve. */

const MODULES_DIR = path.join(__dirname, '..');
const DOMAIN_DIR = path.join(__dirname, '..', '..', 'domain');
const FRONTEND_CAPABILITIES_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'frontend-next',
  'src',
  'types',
  'capabilities.ts',
);

function filesEndingWith(dir: string, suffix: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) filesEndingWith(p, suffix, acc);
    else if (e.name.endsWith(suffix)) acc.push(p);
  }
  return acc;
}

/** Identificador -> valor, para toda `export const X = 'Y';` em domain/**\/*.const.ts. */
function constIdentifierMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of filesEndingWith(DOMAIN_DIR, '.const.ts')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/export const ([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([A-Z0-9_]+)'/g)) {
      map.set(m[1], m[2]);
    }
  }
  return map;
}

/** Resolve um token de capability (identificador ou literal) para o valor de string. */
function resolveToken(token: string, identifiers: Map<string, string>): string {
  const literal = token.match(/^['"]([A-Z0-9_]+)['"]$/);
  if (literal) return literal[1];
  return identifiers.get(token) ?? token;
}

interface Reference {
  name: string;
  file: string;
}

const capabilityFiles = filesEndingWith(MODULES_DIR, '.capabilities.ts');
const identifiers = constIdentifierMap();

function collect(regex: RegExp, group = 1): Reference[] {
  const refs: Reference[] = [];
  for (const file of capabilityFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(MODULES_DIR, file);
    for (const m of text.matchAll(regex)) {
      refs.push({ name: resolveToken(m[group], identifiers), file: rel });
    }
  }
  return refs;
}

const registered = collect(/\.register\(\s*([A-Za-z_][A-Za-z0-9_]*|'[A-Z0-9_]+')/g);
const registeredNames = new Set(registered.map((r) => r.name));

const required: Reference[] = [];
for (const file of capabilityFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(MODULES_DIR, file);
  for (const m of text.matchAll(/\.requires\(\s*[^,]+,\s*\[([^\]]*)\]/g)) {
    for (const token of m[1].split(',').map((t) => t.trim()).filter(Boolean)) {
      required.push({ name: resolveToken(token, identifiers), file: rel });
    }
  }
}

const resolved = collect(/(?<!\.)\bresolve\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g);

function frontendCapabilityValues(): string[] {
  const text = fs.readFileSync(FRONTEND_CAPABILITIES_FILE, 'utf8');
  const block = text.match(/CAPABILITIES\s*=\s*\{([^}]*)\}/);
  expect(block, 'bloco CAPABILITIES não encontrado em types/capabilities.ts').not.toBeNull();
  return [...block![1].matchAll(/:\s*'([A-Z0-9_]+)'/g)].map((m) => m[1]);
}

describe('registro de capabilities — anti-typo', () => {
  it('encontrou ao menos um *.capabilities.ts para varrer', () => {
    expect(capabilityFiles.length).toBeGreaterThan(0);
  });

  it('toda capability em requires([...]) tem um register() correspondente', () => {
    const orphans = required.filter((r) => !registeredNames.has(r.name));
    expect(orphans, JSON.stringify(orphans)).toEqual([]);
  });

  it('toda capability em resolve(...) dentro de um check tem um register() correspondente', () => {
    const orphans = resolved.filter((r) => !registeredNames.has(r.name));
    expect(orphans, JSON.stringify(orphans)).toEqual([]);
  });

  it('todo register() é referenciado por requires, resolve ou pela const do front', () => {
    const frontendValues = new Set(frontendCapabilityValues());
    const referenced = new Set([
      ...required.map((r) => r.name),
      ...resolved.map((r) => r.name),
      ...frontendValues,
    ]);
    const orphanRegistrations = registered.filter((r) => !referenced.has(r.name));
    expect(orphanRegistrations, JSON.stringify(orphanRegistrations)).toEqual([]);
  });

  it('toda capability em frontend-next CAPABILITIES tem um register() correspondente', () => {
    const missing = frontendCapabilityValues().filter((name) => !registeredNames.has(name));
    expect(missing).toEqual([]);
  });
});
