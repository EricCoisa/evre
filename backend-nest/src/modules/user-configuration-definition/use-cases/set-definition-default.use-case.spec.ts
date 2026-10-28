import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SetDefinitionDefaultUseCase } from './set-definition-default.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import type { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';

const numDef = {
  id: 'def-2',
  labelKey: 'FONT_SIZE',
  valueType: 'NUMBER',
  options: [],
  defaultValue: '14',
  isRequired: false,
  secret: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const enumDef = {
  ...numDef,
  id: 'def-3',
  labelKey: 'USERCONFIG_THEME',
  valueType: 'ENUM',
  options: ['light', 'dark'],
  defaultValue: 'light',
};

function setup(row: unknown) {
  const prisma = {
    userConfigurationDefinition: {
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockImplementation((args: { data: unknown }) => ({
        ...(row as object),
        ...(args.data as object),
      })),
    },
  } as unknown as PrismaService;
  const i18n = { t: vi.fn((k: string) => k) } as unknown as I18nService;
  const logging = { create: vi.fn().mockResolvedValue({}) } as unknown as LoggingService;
  const crypto = {
    encryptString: vi.fn((v: string) => `enc:${v}`),
  } as unknown as CryptoService;
  return { useCase: new SetDefinitionDefaultUseCase(prisma, i18n, logging, crypto), prisma, logging };
}

describe('SetDefinitionDefaultUseCase', () => {
  it('lança NotFoundException quando a definição não existe', async () => {
    const { useCase } = setup(null);
    await expect(useCase.execute('def-1', { defaultValue: 'light' }, 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança BadRequestException quando o valor não bate com o valueType', async () => {
    const { useCase } = setup(numDef);
    await expect(useCase.execute('def-2', { defaultValue: 'abc' }, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('grava o novo default quando o tipo confere', async () => {
    const { useCase, prisma } = setup(numDef);
    await expect(useCase.execute('def-2', { defaultValue: '16' }, 'u1')).resolves.toMatchObject({
      defaultValue: '16',
    });
    expect(prisma.userConfigurationDefinition.update).toHaveBeenCalledWith({
      where: { id: 'def-2' },
      data: { defaultValue: '16' },
    });
  });

  // Antes o switch de validateValueType só tratava NUMBER/BOOLEAN/JSON: um ENUM
  // aceitava qualquer string, então USERCONFIG_THEME podia virar um valor que
  // nenhuma tela sabe renderizar.
  it('rejeita valor fora de options num ENUM', async () => {
    const { useCase } = setup(enumDef);
    await expect(useCase.execute('def-3', { defaultValue: 'roxo' }, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('aceita valor presente em options', async () => {
    const { useCase } = setup(enumDef);
    await expect(useCase.execute('def-3', { defaultValue: 'dark' }, 'u1')).resolves.toMatchObject({
      defaultValue: 'dark',
    });
  });

  it('mascara o segredo no log de auditoria', async () => {
    const { useCase, logging } = setup({ ...numDef, secret: true, valueType: 'STRING' });
    await useCase.execute('def-2', { defaultValue: 'sk-live-123' }, 'u1');
    const [entry] = vi.mocked(logging.create).mock.calls[0];
    expect(JSON.stringify(entry)).not.toContain('sk-live-123');
  });
});
