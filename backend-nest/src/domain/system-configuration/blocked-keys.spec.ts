import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Confere que SYSTEMID/SYSTEMTOKEN seguem marcados como `blocked`, invariante de instalação. */
const KEYS_QUE_DEVEM_SER_BLOQUEADAS = ['SYSTEMID', 'SYSTEMTOKEN'];

/** Credencial: a resposta da API tem que sair mascarada (`****`). */
const KEYS_QUE_DEVEM_SER_SECRET = ['SYSTEMTOKEN'];

const seed = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'prisma', 'seeds', 'system-config.seed.ts'),
  'utf8',
);

/** Bloco literal da entrada do seed para uma labelKey. */
function seedEntry(labelKey: string): string {
  const at = seed.indexOf(`labelKey: '${labelKey}'`);
  expect(at, `${labelKey} não está no seed`).toBeGreaterThan(-1);
  const open = seed.lastIndexOf('{', at);
  const close = seed.indexOf('}', at);
  return seed.slice(open, close);
}

describe('configurações bloqueadas', () => {
  it.each(KEYS_QUE_DEVEM_SER_BLOQUEADAS)(
    '%s nasce com blocked: true',
    (key) => {
      expect(seedEntry(key)).toContain('blocked: true');
    },
  );

  it.each(KEYS_QUE_DEVEM_SER_SECRET)('%s nasce com secret: true', (key) => {
    expect(seedEntry(key)).toContain('secret: true');
  });

  // Sem isto, instalações que já rodaram o seed antes ficariam sem a trava para
  // sempre: `update: {}` só criava linha nova e nunca corrigia a existente.
  it('o upsert do seed sincroniza blocked e secret em bases já existentes', () => {
    const upsert = seed.slice(
      seed.indexOf('prisma.systemConfiguration.upsert'),
      seed.indexOf('System configurations created'),
    );
    expect(upsert).toMatch(/update:\s*\{[^}]*blocked/);
    expect(upsert).toMatch(/update:\s*\{[^}]*secret/);
  });

  it('blocked não é aceito em nenhum DTO de escrita', () => {
    const dtos = [
      'create-system-configuration.dto.ts',
      'update-system-configuration.dto.ts',
    ];
    for (const file of dtos) {
      const dto = fs.readFileSync(
        path.join(
          __dirname,
          '..',
          '..',
          'modules',
          'system-configuration',
          'dto',
          file,
        ),
        'utf8',
      );
      expect(dto, `${file} passou a aceitar blocked`).not.toContain('blocked');
    }
  });
});
