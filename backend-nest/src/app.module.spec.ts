import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Confere que `modules.md` lista os mesmos módulos registrados em `app.module.ts`. */

const root = path.join(__dirname, '..');
const appModule = fs.readFileSync(path.join(root, 'src/app.module.ts'), 'utf8');
const doc = fs.readFileSync(
  path.join(root, '..', 'docs', 'backend', 'modules.md'),
  'utf8',
);

/** Módulos do próprio repo: import relativo. Os de pacote não se documentam aqui. */
function firstPartyModules(source: string): string[] {
  const found = new Set<string>();
  const re = /import\s*\{\s*(\w*Module)\s*\}\s*from\s*'\.\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) found.add(m[1]);
  return [...found].sort();
}

const modules = firstPartyModules(appModule);

describe('inventário de módulos × app.module.ts', () => {
  it('encontra os módulos do app (guarda contra o regex silenciar)', () => {
    expect(modules.length).toBeGreaterThan(20);
    expect(modules).toContain('AuthModule');
  });

  it.each(modules)('%s está documentado em docs/backend/modules.md', (name) => {
    expect(
      doc.includes(`\`${name}\``),
      `${name} está no app.module.ts mas não em docs/backend/modules.md`,
    ).toBe(true);
  });
});
