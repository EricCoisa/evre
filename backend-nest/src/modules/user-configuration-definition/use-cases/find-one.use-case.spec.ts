import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { FindOneUserConfigDefinitionUseCase } from './find-one.use-case';
import { FindUserConfigDefinitionByLabelKeyUseCase } from './find-by-label-key.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';

const defRow = {
  id: 'def-1',
  labelKey: 'THEME',
  valueType: 'STRING',
  options: [],
  defaultValue: 'dark',
  isRequired: false,
  secret: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const numDef = { ...defRow, id: 'def-2', labelKey: 'FONT_SIZE', valueType: 'NUMBER', defaultValue: '14' };

function setup(row: unknown) {
  const prisma = {
    userConfigurationDefinition: { findUnique: vi.fn().mockResolvedValue(row) },
  } as unknown as PrismaService;
  const i18n = { t: vi.fn((k: string) => k) } as unknown as I18nService;
  return {
    byId: new FindOneUserConfigDefinitionUseCase(prisma, i18n),
    byKey: new FindUserConfigDefinitionByLabelKeyUseCase(prisma, i18n),
  };
}

// Portados de user-configuration-definition.service.spec.ts, que testava a cópia
// morta deste mesmo fluxo (o controller sempre chamou os use-cases).
describe('FindOneUserConfigDefinitionUseCase', () => {
  it('converte defaultValue conforme o valueType', async () => {
    const { byId } = setup(numDef);
    await expect(byId.execute('def-2')).resolves.toMatchObject({ defaultValue: 14 });
  });

  it('mantém defaultValue nulo em vez de virar string', async () => {
    const { byId } = setup({ ...defRow, defaultValue: null });
    await expect(byId.execute('def-1')).resolves.toMatchObject({ defaultValue: null });
  });

  it('lança NotFoundException quando não existe', async () => {
    const { byId } = setup(null);
    await expect(byId.execute('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('FindUserConfigDefinitionByLabelKeyUseCase (definições)', () => {
  it('busca por labelKey', async () => {
    const { byKey } = setup(defRow);
    await expect(byKey.execute('THEME')).resolves.toMatchObject({ labelKey: 'THEME' });
  });

  it('mantém defaultValue nulo', async () => {
    const { byKey } = setup({ ...defRow, defaultValue: null });
    await expect(byKey.execute('THEME')).resolves.toMatchObject({ defaultValue: null });
  });

  it('lança NotFoundException quando não existe', async () => {
    const { byKey } = setup(null);
    await expect(byKey.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('usa o namespace i18n do próprio módulo, não o do sistema', async () => {
    const prisma = {
      userConfigurationDefinition: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const t = vi.fn((k: string) => k);
    const i18n = { t } as unknown as I18nService;

    await expect(new FindUserConfigDefinitionByLabelKeyUseCase(prisma, i18n).execute('x')).rejects.toThrow();
    expect(t).toHaveBeenCalledWith('user_configuration.definition_not_found');
  });
});
