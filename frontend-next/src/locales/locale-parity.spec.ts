import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Compara cada arquivo de en/ com o homônimo em pt-BR/ e lista chaves ausentes. */

const LOCALES_DIR = __dirname;

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

function keysOf(file: string): Set<string> {
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const out = new Set<string>();
  flatten(json, '', out);
  return out;
}

const enFiles = fs
  .readdirSync(path.join(LOCALES_DIR, 'en'))
  .filter((f) => f.endsWith('.json'))
  .sort();

describe('paridade de locales (en <-> pt-BR)', () => {
  for (const file of enFiles) {
    it(`${file}: mesmas chaves nos dois idiomas`, () => {
      const enPath = path.join(LOCALES_DIR, 'en', file);
      const ptPath = path.join(LOCALES_DIR, 'pt-BR', file);

      expect(fs.existsSync(ptPath), `pt-BR/${file} não existe (en/${file} existe)`).toBe(true);

      const enKeys = keysOf(enPath);
      const ptKeys = keysOf(ptPath);

      const missingInPt = [...enKeys]
        .filter((k) => !ptKeys.has(k))
        .sort()
        .map((k) => `pt-BR/${file} <- falta "${k}" (presente em en/${file})`);
      const missingInEn = [...ptKeys]
        .filter((k) => !enKeys.has(k))
        .sort()
        .map((k) => `en/${file} <- falta "${k}" (presente em pt-BR/${file})`);

      const diffs = [...missingInPt, ...missingInEn];
      expect(diffs, diffs.join('\n')).toEqual([]);
    });
  }

  it('pt-BR/ não tem arquivo extra sem par em en/', () => {
    const ptFiles = fs
      .readdirSync(path.join(LOCALES_DIR, 'pt-BR'))
      .filter((f) => f.endsWith('.json'))
      .sort();
    const onlyInPt = ptFiles.filter((f) => !enFiles.includes(f));
    expect(onlyInPt, `arquivos só em pt-BR/: ${onlyInPt.join(', ')}`).toEqual([]);
  });
});
