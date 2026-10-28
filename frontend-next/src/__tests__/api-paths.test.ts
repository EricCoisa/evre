import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fg from 'fast-glob';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const OPENAPI = resolve(ROOT, '../backend-nest/openapi.json');
const GENERATED_PATHS = resolve(ROOT, 'src/lib/generated/paths.ts');

const CALL_LAYER = [
  'src/lib/actions/**/*.ts',
  'src/lib/api/**/*.ts',
  'src/middleware.ts',
  'src/app/api/**/*.ts',
];

const PATH_REF = /(?:['"`]|\})(\/[A-Za-z][A-Za-z0-9/_.$(){}[\]-]*)/g;

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const spec = JSON.parse(readFileSync(OPENAPI, 'utf8')) as {
  paths: Record<string, unknown>;
};
const backendRoots = new Set(
  Object.keys(spec.paths).map((p) => p.split('/')[1]),
);

const handTyped = fg
  .sync(CALL_LAYER, { cwd: ROOT, ignore: ['**/*.test.ts', '**/*.spec.ts'] })
  .flatMap((file) => {
    const lines = stripComments(readFileSync(resolve(ROOT, file), 'utf8')).split('\n');
    return lines.flatMap((line, i) =>
      line.includes('APINEXT')
        ? []
        : [...line.matchAll(PATH_REF)]
            .map((m) => m[1])
            .filter((p) => backendRoots.has(p.replace(/\$\{[^}]*\}/g, 'x').split('/')[1]))
            .map((p) => `${file}:${i + 1}  ${p}`),
    );
  });

describe('paths do backend no frontend', () => {
  it('nenhum path e escrito a mao na camada de chamada', () => {
    expect(handTyped).toEqual([]);
  });

  it('paths.ts esta em sincronia com o openapi.json', () => {
    const before = readFileSync(GENERATED_PATHS, 'utf8');
    execFileSync('node', ['scripts/generate-api-paths.mjs'], { cwd: ROOT });
    const after = readFileSync(GENERATED_PATHS, 'utf8');

    expect(after).toBe(before);
  });
});
