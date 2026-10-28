import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateUserConfigDefinitionUseCase } from './update.use-case';
import { RemoveUserConfigDefinitionUseCase } from './remove.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import type { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';

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

function setup() {
  const prisma = {
    userConfigurationDefinition: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
  const t = vi.fn((k: string) => k);
  const i18n = { t } as unknown as I18nService;
  const logging = { create: vi.fn().mockResolvedValue({}) } as unknown as LoggingService;
  const crypto = {
    encryptString: vi.fn((v: string) => `enc:${v}`),
  } as unknown as CryptoService;
  return {
    prisma,
    t,
    logging,
    update: new UpdateUserConfigDefinitionUseCase(prisma, i18n, logging, crypto),
    remove: new RemoveUserConfigDefinitionUseCase(prisma, i18n, logging),
  };
}

// Portados de user-configuration-definition.service.spec.ts.
describe('UpdateUserConfigDefinitionUseCase', () => {
  it('lança NotFoundException quando a definição não existe', async () => {
    const { update, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue(null);
    await expect(update.execute('missing', { defaultValue: 'light' }, 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança ConflictException quando o novo labelKey já pertence a outra definição', async () => {
    const { update, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique)
      .mockResolvedValueOnce(defRow as never)
      .mockResolvedValueOnce({ ...defRow, id: 'def-99' } as never);
    await expect(update.execute('def-1', { labelKey: 'TAKEN' }, 'u1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('atualiza quando o labelKey não muda', async () => {
    const { update, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue(defRow as never);
    vi.mocked(prisma.userConfigurationDefinition.update).mockResolvedValue({
      ...defRow,
      defaultValue: 'light',
    } as never);
    await expect(update.execute('def-1', { defaultValue: 'light' }, 'u1')).resolves.toMatchObject({
      defaultValue: 'light',
    });
  });

  it('mantém defaultValue nulo', async () => {
    const { update, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue(defRow as never);
    vi.mocked(prisma.userConfigurationDefinition.update).mockResolvedValue({
      ...defRow,
      defaultValue: null,
    } as never);
    await expect(
      update.execute('def-1', { defaultValue: null } as never, 'u1'),
    ).resolves.toMatchObject({ defaultValue: null });
  });
});

describe('RemoveUserConfigDefinitionUseCase', () => {
  it('lança NotFoundException quando não existe', async () => {
    const { remove, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue(null);
    await expect(remove.execute('missing', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('deleta e devolve status true', async () => {
    const { remove, prisma } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue(defRow as never);
    await expect(remove.execute('def-1', 'u1')).resolves.toMatchObject({ status: true });
    expect(prisma.userConfigurationDefinition.delete).toHaveBeenCalledWith({
      where: { id: 'def-1' },
    });
  });

  it('usa a chave i18n do próprio módulo na mensagem de sucesso', async () => {
    const { remove, prisma, t } = setup();
    vi.mocked(prisma.userConfigurationDefinition.findUnique).mockResolvedValue(defRow as never);
    await remove.execute('def-1', 'u1');
    expect(t).toHaveBeenCalledWith('user_configuration.definition_deleted');
  });
});
