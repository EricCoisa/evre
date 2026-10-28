import { describe, it, expect, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { CreateUserConfigDefinitionUseCase } from './create.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import type { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';

function setup() {
  const prisma = {
    userConfigurationDefinition: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'def-1',
        labelKey: 'USERCONFIG_THEME',
        valueType: 'ENUM',
        options: ['light', 'dark'],
        defaultValue: 'light',
        secret: false,
      }),
    },
  } as unknown as PrismaService;
  const i18n = { t: vi.fn().mockReturnValue('já existe') } as unknown as I18nService;
  const loggingService = { create: vi.fn().mockResolvedValue(undefined) } as unknown as LoggingService;
  const cryptoService = {
    encryptString: vi.fn((v: string) => `enc:${v}`),
    tryDecrypt: vi.fn((v: string) => v),
  } as unknown as CryptoService;

  return {
    useCase: new CreateUserConfigDefinitionUseCase(prisma, i18n, loggingService, cryptoService),
    prisma,
  };
}

describe('CreateUserConfigDefinitionUseCase', () => {
  it('throws ConflictException when the labelKey already exists', async () => {
    const { useCase, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue({
      id: 'existing',
    } as never);

    await expect(
      useCase.execute(
        { labelKey: 'USERCONFIG_THEME', valueType: 'ENUM', options: ['light', 'dark'], defaultValue: 'dark' },
        'u1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('passes defaultValue (not value) through to Prisma create', async () => {
    const { useCase, prisma } = setup();

    await useCase.execute(
      { labelKey: 'USERCONFIG_THEME', valueType: 'ENUM', options: ['light', 'dark'], defaultValue: 'dark' },
      'u1',
    );

    expect(prisma.userConfigurationDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ defaultValue: 'dark' }),
    });
    const [[callArg]] = vi.mocked(prisma.userConfigurationDefinition.create).mock.calls;
    expect(callArg.data).not.toHaveProperty('value');
  });
});
