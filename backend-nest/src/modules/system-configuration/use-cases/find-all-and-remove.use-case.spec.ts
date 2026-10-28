import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { FindAllSystemConfigurationUseCase } from './find-all.use-case';
import { RemoveSystemConfigurationUseCase } from './remove.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { LoggingService } from '../../logging/logging.service';
import type { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import type { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { CapabilityRegistry } from '../../capability/capability.registry';

const mockCapabilities = {
  resolveAll: vi.fn().mockResolvedValue({}),
  requirementsFor: vi.fn().mockReturnValue([]),
};

const mockPrisma = {
  systemConfiguration: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};
const mockCrypto = {
  encryptString: vi.fn((v: string) => `ENC:${v}`),
  tryDecrypt: vi.fn((v: string | null) =>
    v != null ? (v.startsWith('ENC:') ? v.slice(4) : v) : v,
  ),
};
const mockI18n = { t: vi.fn((k: string) => k) };
const mockLogging = { create: vi.fn().mockResolvedValue({}) };
const mockRedis = { del: vi.fn().mockResolvedValue(undefined) };

const prisma = mockPrisma as unknown as PrismaService;
const crypto = mockCrypto as unknown as CryptoService;

const base = { page: 1, limit: 10, pagination: false, search: undefined, filter: undefined };
const paged = { ...base, pagination: true };

const plainConfig = {
  id: 'cfg-1',
  labelKey: 'SOME_KEY',
  value: 'hello',
  valueType: 'string',
  secret: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const secretConfig = { ...plainConfig, id: 'cfg-2', labelKey: 'SECRET_KEY', value: 'ENC:supersecret', secret: true };

const findAll = () =>
  new FindAllSystemConfigurationUseCase(
    prisma,
    crypto,
    mockCapabilities as unknown as CapabilityRegistry,
  );
const ADMIN = { roleName: 'ADMIN' };
const remove = () =>
  new RemoveSystemConfigurationUseCase(
    prisma,
    mockI18n as unknown as I18nService,
    mockLogging as unknown as LoggingService,
    mockRedis as unknown as RedisService,
  );

beforeEach(() => vi.clearAllMocks());

describe('FindAllSystemConfigurationUseCase', () => {
  it('devolve os valores em claro sem paginação', async () => {
    mockPrisma.systemConfiguration.findMany.mockResolvedValue([plainConfig]);
    const result = (await findAll().execute(base, ADMIN)) as Array<{ value: unknown }>;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].value).toBe('hello');
  });

  it('descriptografa configs secretas', async () => {
    mockPrisma.systemConfiguration.findMany.mockResolvedValue([secretConfig]);
    const result = (await findAll().execute(base, ADMIN)) as Array<{ value: unknown }>;
    expect(mockCrypto.tryDecrypt).toHaveBeenCalledWith('ENC:supersecret');
    expect(result[0].value).toBe('supersecret');
  });

  it('devolve data+meta com paginação', async () => {
    mockPrisma.systemConfiguration.findMany.mockResolvedValue([plainConfig]);
    mockPrisma.systemConfiguration.count.mockResolvedValue(1);
    const result = await findAll().execute(paged, ADMIN);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });

  it('descriptografa também na resposta paginada', async () => {
    mockPrisma.systemConfiguration.findMany.mockResolvedValue([secretConfig]);
    mockPrisma.systemConfiguration.count.mockResolvedValue(1);
    const result = (await findAll().execute(paged, ADMIN)) as { data: Array<{ value: unknown }> };
    expect(result.data[0].value).toBe('supersecret');
  });

  it.each([
    ['paginada', paged],
    ['sem paginação', base],
  ])('mantém value nulo (%s)', async (_label, query) => {
    mockPrisma.systemConfiguration.findMany.mockResolvedValue([{ ...plainConfig, value: null }]);
    mockPrisma.systemConfiguration.count.mockResolvedValue(1);
    const result = await findAll().execute(query, ADMIN);
    const row = Array.isArray(result)
      ? (result[0] as { value: unknown })
      : (result.data[0] as { value: unknown });
    expect(row.value).toBeNull();
  });

  it('aplica o termo de busca', async () => {
    mockPrisma.systemConfiguration.findMany.mockResolvedValue([]);
    mockPrisma.systemConfiguration.count.mockResolvedValue(0);
    await findAll().execute({ ...paged, search: 'SOME' }, ADMIN);
    expect(mockPrisma.systemConfiguration.findMany).toHaveBeenCalled();
  });
});

describe('RemoveSystemConfigurationUseCase', () => {
  it('lança NotFoundException quando não existe', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    await expect(remove().execute('u1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('deleta e devolve status true', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    mockPrisma.systemConfiguration.delete.mockResolvedValue({});
    await expect(remove().execute('u1', 'cfg-1')).resolves.toHaveProperty('status', true);
  });

  it('não escreve o segredo em claro no log', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    mockPrisma.systemConfiguration.delete.mockResolvedValue({});
    await expect(remove().execute('u1', 'cfg-2')).resolves.toHaveProperty('status', true);
    expect(JSON.stringify(mockLogging.create.mock.calls)).not.toContain('supersecret');
  });
});
