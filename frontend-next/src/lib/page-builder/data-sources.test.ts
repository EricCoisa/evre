import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { DATA_SOURCES } from './data-sources';

interface PageSourceExtension {
  key: string;
  kind: string;
  roles?: string[];
}

/** Garante que todo endpoint marcado como pageSource no backend tem adapter correspondente no front. */
function pageSourcesFromOpenApi(): PageSourceExtension[] {
  const specPath = path.resolve(__dirname, '../../../../backend-nest/openapi.json');
  const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as {
    paths: Record<string, Record<string, { 'x-page-source'?: PageSourceExtension }>>;
  };
  return Object.values(spec.paths)
    .flatMap((ops) => Object.values(ops))
    .map((op) => op['x-page-source'])
    .filter((s): s is PageSourceExtension => !!s);
}

describe('DATA_SOURCES', () => {
  const fromBackend = pageSourcesFromOpenApi();

  it('o backend expõe pelo menos uma fonte marcada', () => {
    expect(fromBackend.length).toBeGreaterThan(0);
  });

  it('toda fonte marcada no backend tem um adapter no front', () => {
    const missing = fromBackend
      .map((s) => s.key)
      .filter((key) => !DATA_SOURCES[key]);

    expect(missing).toEqual([]);
  });

  it('o kind declarado no backend bate com o do adapter', () => {
    const mismatched = fromBackend
      .filter((s) => DATA_SOURCES[s.key] && DATA_SOURCES[s.key].kind !== s.kind)
      .map((s) => s.key);

    expect(mismatched).toEqual([]);
  });

  it('não existe adapter apontando para fonte que o backend não liberou', () => {
    const known = new Set(fromBackend.map((s) => s.key));
    const orphans = Object.keys(DATA_SOURCES).filter((key) => !known.has(key));

    expect(orphans).toEqual([]);
  });
});
