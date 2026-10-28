import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import type { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { GetUserConfigurationsUseCase } from './get-user-configurations.use-case';
import { GetUserConfigurationByKeyUseCase } from './get-by-key.use-case';
import { SetUserConfigurationUseCase } from './set-user-configuration.use-case';
import { ResetUserConfigurationUseCase } from './reset-user-configuration.use-case';
import { ResetAllUserConfigurationsUseCase } from './reset-all.use-case';
import type { CapabilityRegistry } from '../../capability/capability.registry';

const mockCapabilities = {
  resolveAll: vi.fn().mockResolvedValue({}),
  requirementsFor: vi.fn().mockReturnValue([]),
};

const mockPrisma = {
  userConfigurationDefinition: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  userConfiguration: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

const mockI18n = { t: vi.fn((k: string) => k) };
const mockLogging = { create: vi.fn().mockResolvedValue({}) };
const mockCrypto = {
  encryptString: vi.fn((v: string) => `enc:${v}`),
  tryDecrypt: vi.fn((v: string) => v.replace('enc:', '')),
};

const prisma = mockPrisma as unknown as PrismaService;
const i18n = mockI18n as unknown as I18nService;
const logging = mockLogging as unknown as LoggingService;
const crypto = mockCrypto as unknown as CryptoService;

const defRow = {
  id: 'def-1',
  labelKey: 'THEME',
  valueType: 'string',
  options: [],
  defaultValue: 'dark',
  isRequired: false,
  secret: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const numDef = { ...defRow, id: 'def-2', labelKey: 'FONT_SIZE', valueType: 'number', defaultValue: '14' };
const secretDef = { ...defRow, id: 'def-3', labelKey: 'API_KEY', defaultValue: null, secret: true };

beforeEach(() => vi.clearAllMocks());

describe('GetUserConfigurationsUseCase', () => {
  const useCase = () => new GetUserConfigurationsUseCase(prisma);

  it('mescla definições com os valores do usuário', async () => {
    mockPrisma.userConfigurationDefinition.findMany.mockResolvedValue([defRow, numDef]);
    mockPrisma.userConfiguration.findMany.mockResolvedValue([
      { id: 'uc-1', userId: 'u1', definitionId: 'def-1', value: 'light', definition: defRow },
    ]);

    const result = await useCase().execute('u1');

    const theme = result.find((c) => c.labelKey === 'THEME')!;
    expect(theme.isCustomized).toBe(true);
    expect(theme.value).toBe('light');

    const fontSize = result.find((c) => c.labelKey === 'FONT_SIZE')!;
    expect(fontSize.isCustomized).toBe(false);
    expect(fontSize.value).toBe(14);
  });

  it('mascara valor secreto como *** e marca isSecret', async () => {
    mockPrisma.userConfigurationDefinition.findMany.mockResolvedValue([secretDef]);
    mockPrisma.userConfiguration.findMany.mockResolvedValue([
      { id: 'uc-3', userId: 'u1', definitionId: 'def-3', value: 'enc:my-api-key', definition: secretDef },
    ]);

    const apiKey = (await useCase().execute('u1')).find((c) => c.labelKey === 'API_KEY')!;
    expect(apiKey.value).toBe('***');
    expect(apiKey.isSecret).toBe(true);
  });
});

describe('GetUserConfigurationByKeyUseCase', () => {
  const useCase = () =>
    new GetUserConfigurationByKeyUseCase(
      prisma,
      mockCapabilities as unknown as CapabilityRegistry,
    );
  const ADMIN = { roleName: 'ADMIN' };

  it('devolve null quando a definição não existe', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(null);
    await expect(useCase().execute('u1', 'MISSING', ADMIN)).resolves.toBeNull();
  });

  it('devolve o valor do usuário quando personalizado', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue({
      id: 'uc-1', userId: 'u1', definitionId: 'def-1', value: 'light', definition: defRow,
    });
    await expect(useCase().execute('u1', 'THEME', ADMIN)).resolves.toMatchObject({
      isCustomized: true,
      value: 'light',
    });
  });

  it('cai no defaultValue quando o usuário não personalizou', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue(null);
    await expect(useCase().execute('u1', 'THEME', ADMIN)).resolves.toMatchObject({
      isCustomized: false,
      value: 'dark',
    });
  });

  it('mascara valor secreto como ***', async () => {
    mockPrisma.userConfigurationDefinition.findFirst.mockResolvedValue(secretDef);
    mockPrisma.userConfiguration.findFirst.mockResolvedValue({
      id: 'uc-3', userId: 'u1', definitionId: 'def-3', value: 'enc:my-api-key', definition: secretDef,
    });
    await expect(useCase().execute('u1', 'API_KEY', ADMIN)).resolves.toMatchObject({
      value: '***',
      isSecret: true,
    });
  });
});

describe('SetUserConfigurationUseCase', () => {
  const useCase = () => new SetUserConfigurationUseCase(prisma, i18n, logging, crypto);

  it('lança NotFoundException quando a definição não existe', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(null);
    await expect(
      useCase().execute('u1', { definitionId: 'missing', value: 'v' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança BadRequestException quando o valor não bate com o valueType', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(numDef);
    await expect(
      useCase().execute('u1', { definitionId: 'def-2', value: 'abc' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('faz upsert e registra no log', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(numDef);
    mockPrisma.userConfiguration.upsert.mockResolvedValue({
      id: 'uc-1', userId: 'u1', definitionId: 'def-2', value: '16', definition: numDef,
    });
    await expect(
      useCase().execute('u1', { definitionId: 'def-2', value: '16' }, 'admin'),
    ).resolves.toMatchObject({ value: '16' });
    expect(mockLogging.create).toHaveBeenCalled();
  });

  it('usa o userId como performedById quando não informado', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.upsert.mockResolvedValue({
      id: 'uc-1', userId: 'u1', definitionId: 'def-1', value: 'light', definition: defRow,
    });
    await useCase().execute('u1', { definitionId: 'def-1', value: 'light' });
    expect(mockLogging.create).toHaveBeenCalledWith(expect.any(Object), 'u1');
  });

  it('criptografa o valor quando a definição é secret', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(secretDef);
    mockPrisma.userConfiguration.upsert.mockResolvedValue({
      id: 'uc-3', userId: 'u1', definitionId: 'def-3', value: 'enc:my-api-key', definition: secretDef,
    });
    await useCase().execute('u1', { definitionId: 'def-3', value: 'my-api-key' }, 'admin');
    expect(mockCrypto.encryptString).toHaveBeenCalledWith('my-api-key');
    expect(mockPrisma.userConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ value: 'enc:my-api-key' }) }),
    );
  });

  it('registra *** no log em vez do segredo em claro', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(secretDef);
    mockPrisma.userConfiguration.upsert.mockResolvedValue({
      id: 'uc-3', userId: 'u1', definitionId: 'def-3', value: 'enc:my-api-key', definition: secretDef,
    });
    await useCase().execute('u1', { definitionId: 'def-3', value: 'my-api-key' }, 'admin');
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ value: '***' }) }),
      'admin',
    );
  });
});

describe('ResetUserConfigurationUseCase', () => {
  const useCase = () => new ResetUserConfigurationUseCase(prisma, i18n, logging);
  const existing = { id: 'uc-1', userId: 'u1', definitionId: 'def-1', value: 'light' };

  it('lança NotFoundException quando a definição não existe', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(null);
    await expect(useCase().execute('u1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('deleta a linha do usuário e registra no log', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findUnique.mockResolvedValue(existing);
    await expect(useCase().execute('u1', 'def-1', 'admin')).resolves.toHaveProperty('message');
    expect(mockPrisma.userConfiguration.delete).toHaveBeenCalled();
  });

  it('não falha quando o usuário nunca personalizou a chave', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findUnique.mockResolvedValue(null);
    await expect(useCase().execute('u1', 'def-1')).resolves.toHaveProperty('message');
    expect(mockPrisma.userConfiguration.delete).not.toHaveBeenCalled();
  });

  it('usa o userId como performedById quando não informado', async () => {
    mockPrisma.userConfigurationDefinition.findUnique.mockResolvedValue(defRow);
    mockPrisma.userConfiguration.findUnique.mockResolvedValue(existing);
    await useCase().execute('u1', 'def-1');
    expect(mockLogging.create).toHaveBeenCalledWith(expect.any(Object), 'u1');
  });
});

describe('ResetAllUserConfigurationsUseCase', () => {
  const useCase = () => new ResetAllUserConfigurationsUseCase(prisma, i18n, logging);

  it('apaga todas as configurações do usuário', async () => {
    mockPrisma.userConfiguration.deleteMany.mockResolvedValue({ count: 3 });
    await expect(useCase().execute('u1', 'admin')).resolves.toHaveProperty('message');
    expect(mockPrisma.userConfiguration.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('usa o userId como performedById quando não informado', async () => {
    mockPrisma.userConfiguration.deleteMany.mockResolvedValue({ count: 0 });
    await useCase().execute('u1');
    expect(mockLogging.create).toHaveBeenCalled();
  });
});
