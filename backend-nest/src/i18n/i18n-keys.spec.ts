import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Garante que toda chave i18n referenciada no código existe nos locales, com paridade entre eles. */

const I18N_DIR = path.join(__dirname);
const SRC_DIR = path.join(__dirname, '..');
const LOCALES = ['pt-BR', 'en'] as const;

function flatten(obj: Record<string, unknown>, prefix: string, out: Set<string>) {
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, next, out);
    } else {
      out.add(next);
    }
  }
}

function keysOf(locale: string): Set<string> {
  const dir = path.join(I18N_DIR, locale);
  const out = new Set<string>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, unknown>;
    flatten(json, file.replace('.json', ''), out);
  }
  return out;
}

function tsFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsFiles(p, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
}

const ptKeys = keysOf('pt-BR');
const enKeys = keysOf('en');
const namespaces = new Set([...ptKeys].map((k) => k.split('.')[0]));

function referencedKeys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of tsFiles(SRC_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/['`]([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)['`]/g)) {
      const key = m[1];
      if (!namespaces.has(key.split('.')[0])) continue;
      // `example:` do Swagger carrega strings pontuadas que não são chaves i18n.
      if (/example\s*:\s*$/.test(text.slice(Math.max(0, m.index! - 14), m.index!))) continue;
      // Nome de arquivo (ex.: `notification.html` em EMAIL_TEMPLATE_FILES) coincide com um
      // namespace por acaso — chave i18n nunca termina em extensão de arquivo.
      if (/\.(html|json|txt|css|js|ts)$/.test(key)) continue;
      if (!found.has(key)) found.set(key, path.relative(SRC_DIR, file));
    }
  }
  return found;
}

// varredura única — chamada repetida por teste multiplicaria o I/O pelo número de testes
const refKeys = referencedKeys();

describe('chaves i18n', () => {
  it('toda chave referenciada no código existe em pt-BR', () => {
    const missing = [...refKeys]
      .filter(([k]) => !ptKeys.has(k))
      .map(([k, f]) => `${k}  <- ${f}`);
    expect(missing, `chaves ausentes em pt-BR:\n${missing.join('\n')}`).toEqual([]);
  });

  it('toda chave referenciada no código existe em en', () => {
    const missing = [...refKeys]
      .filter(([k]) => !enKeys.has(k))
      .map(([k, f]) => `${k}  <- ${f}`);
    expect(missing, `chaves ausentes em en:\n${missing.join('\n')}`).toEqual([]);
  });

  it('os locales têm exatamente as mesmas chaves', () => {
    const onlyPt = [...ptKeys].filter((k) => !enKeys.has(k)).sort();
    const onlyEn = [...enKeys].filter((k) => !ptKeys.has(k)).sort();
    expect({ onlyPt, onlyEn }).toEqual({ onlyPt: [], onlyEn: [] });
  });

  for (const locale of LOCALES) {
    it(`${locale} não tem namespace órfão (arquivo sem nenhuma referência no código)`, () => {
      const used = new Set([...refKeys.keys()].map((k) => k.split('.')[0]));
      const files = fs
        .readdirSync(path.join(I18N_DIR, locale))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
      expect(files.filter((ns) => !used.has(ns))).toEqual([]);
    });
  }
});
