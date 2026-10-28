import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SystemConfigurationService } from './system-configuration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../logging/logging.service';
import { LogClearTask } from '../tasks/logClear.task';
import { CryptoService } from '../../common/infrastructure/crypto/crypto.service';
import { RedisService } from '../../common/infrastructure/redis/redis.service';
import { FindOneSystemConfigurationUseCase } from './use-cases/find-one.use-case';
import { CreateSystemConfigurationUseCase } from './use-cases/create.use-case';
import { UpdateSystemConfigurationUseCase } from './use-cases/update.use-case';

/** Leituras com cache e helpers; use-cases reais. */

const mockPrisma = {
  systemConfiguration: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

const mockI18n = { t: vi.fn((k: string) => k) };
const mockLogging = { create: vi.fn() };
const mockLogClearTask = { updateCronSchedule: vi.fn() };
const mockCrypto = {
  encryptString: vi.fn((v: string) => `ENC:${v}`),
  tryDecrypt: vi.fn((v: string | null) =>
    v != null ? (v.startsWith('ENC:') ? v.slice(4) : v) : v,
  ),
};
const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

const plainConfig = {
  id: 'cfg-1',
  labelKey: 'SOME_KEY',
  value: 'hello',
  valueType: 'string',
  secret: false,
  blocked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const secretConfig = {
  ...plainConfig,
  id: 'cfg-2',
  labelKey: 'SECRET_KEY',
  value: 'ENC:supersecret',
  secret: true,
};

describe('SystemConfigurationService', () => {
  let service: SystemConfigurationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigurationService,
        FindOneSystemConfigurationUseCase,
        CreateSystemConfigurationUseCase,
        UpdateSystemConfigurationUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: LogClearTask, useValue: mockLogClearTask },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<SystemConfigurationService>(
      SystemConfigurationService,
    );
    mockLogging.create.mockResolvedValue({});
  });

  afterEach(() => vi.clearAllMocks());

  // ─── findByLabelKey ───────────────────────────────────────────

  it('findByLabelKey devolve a config', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    expect((await service.findByLabelKey('SOME_KEY')).labelKey).toBe('SOME_KEY');
  });

  it('findByLabelKey descriptografa config secreta', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    expect((await service.findByLabelKey('SECRET_KEY')).value).toBe(
      'supersecret',
    );
    expect(mockCrypto.tryDecrypt).toHaveBeenCalled();
  });

  it('findByLabelKey trata value null', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue({
      ...plainConfig,
      value: null,
    });
    expect((await service.findByLabelKey('SOME_KEY')).value).toBeNull();
  });

  it('findByLabelKey lança NotFoundException quando não existe', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    await expect(service.findByLabelKey('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findOne delega ao use-case', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    const result = await service.findOne('cfg-1');
    expect(result.labelKey).toBe('SOME_KEY');
  });

  // ─── cache Redis das leituras por labelKey ──────────────────────────────

  it('cache corrompido (JSON inválido) cai no banco em vez de estourar', async () => {
    mockRedis.get.mockResolvedValueOnce('{not json');
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    expect((await service.findByLabelKey('SOME_KEY')).labelKey).toBe('SOME_KEY');
    expect(mockPrisma.systemConfiguration.findUnique).toHaveBeenCalled();
  });

  it('findByLabelKey grava no cache no miss e nao vai ao banco no hit', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    await service.findByLabelKey('SOME_KEY');
    expect(mockRedis.set).toHaveBeenCalledWith(
      'sysconfig:SOME_KEY',
      JSON.stringify(plainConfig),
      300,
    );

    mockPrisma.systemConfiguration.findUnique.mockClear();
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(plainConfig));
    const cached = await service.findByLabelKey('SOME_KEY');
    expect(mockPrisma.systemConfiguration.findUnique).not.toHaveBeenCalled();
    expect(cached.value).toBe('hello');
    expect(cached.updatedAt).toBeInstanceOf(Date);
  });

  it('cache de segredo guarda o valor cifrado, nao o texto claro', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    const result = await service.findByLabelKey('SECRET_KEY');
    expect(result.value).toBe('supersecret');
    expect(mockRedis.set).toHaveBeenCalledWith(
      'sysconfig:SECRET_KEY',
      expect.stringContaining('ENC:supersecret'),
      300,
    );
    const [, payload] = mockRedis.set.mock.calls[0] as [string, string, number];
    expect(payload).not.toContain('"value":"supersecret"');
  });

  it('getValueOrNull cacheia a ausencia da chave e nao reconsulta', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    expect(await service.getValueOrNull('missing')).toBeNull();
    expect(mockRedis.set).toHaveBeenCalledWith(
      'sysconfig:missing',
      '__missing__',
      300,
    );

    mockPrisma.systemConfiguration.findUnique.mockClear();
    mockRedis.get.mockResolvedValueOnce('__missing__');
    expect(await service.getValueOrNull('missing')).toBeNull();
    expect(mockPrisma.systemConfiguration.findUnique).not.toHaveBeenCalled();
  });

  // ─── keepStoredWhenBlank ──────────────────────────────────────

  it('keepStoredWhenBlank devolve o valor gravado quando o campo vem vazio', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    expect(await service.keepStoredWhenBlank('   ', 'SECRET_KEY')).toBe(
      'supersecret',
    );
  });

  it('keepStoredWhenBlank prefere o valor novo quando ele vem preenchido', async () => {
    expect(await service.keepStoredWhenBlank('novo', 'SECRET_KEY')).toBe('novo');
    expect(mockPrisma.systemConfiguration.findUnique).not.toHaveBeenCalled();
  });

  it('keepStoredWhenBlank devolve string vazia quando não há nada gravado', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    expect(await service.keepStoredWhenBlank('   ', 'NUNCA_GRAVADA')).toBe('');
  });

  // ─── setManyByLabelKey — o caminho de escrita dos formulários de provider ──

  it('setManyByLabelKey atualiza a chave que já existe', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    mockPrisma.systemConfiguration.update.mockResolvedValue(plainConfig);

    await service.setManyByLabelKey(
      [{ labelKey: 'SOME_KEY', value: 'novo' }],
      'admin',
    );

    expect(mockPrisma.systemConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cfg-1' } }),
    );
    expect(mockPrisma.systemConfiguration.create).not.toHaveBeenCalled();
  });

  it('setManyByLabelKey cria a chave que ainda não foi semeada', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.systemConfiguration.create.mockResolvedValue(plainConfig);

    await service.setManyByLabelKey(
      [{ labelKey: 'NEW_KEY', value: 'v', secret: true }],
      'admin',
    );

    expect(mockPrisma.systemConfiguration.create).toHaveBeenCalled();
    expect(mockCrypto.encryptString).toHaveBeenCalledWith('v');
  });

  it('setManyByLabelKey cria sem secret/valueType/options como não-secreta STRING sem opções', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.systemConfiguration.create.mockResolvedValue(plainConfig);

    await service.setManyByLabelKey([{ labelKey: 'NEW_KEY', value: 'v' }], 'admin');

    expect(mockPrisma.systemConfiguration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          valueType: 'STRING',
          options: [],
          secret: false,
        }),
      }),
    );
  });

  it('setManyByLabelKey respeita o guard de blocked', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue({
      ...plainConfig,
      labelKey: 'SYSTEMTOKEN',
      blocked: true,
    });

    await expect(
      service.setManyByLabelKey(
        [{ labelKey: 'SYSTEMTOKEN', value: 'roubado' }],
        'admin',
      ),
    ).rejects.toThrow();
    expect(mockPrisma.systemConfiguration.update).not.toHaveBeenCalled();
  });

  // ─── allFilled — check de capability sem o que pingar ──────────────────

  function mockFindUniqueByValue(values: Record<string, string | null>) {
    mockPrisma.systemConfiguration.findUnique.mockImplementation(
      ({ where: { labelKey } }: { where: { labelKey: string } }) => {
        const value = values[labelKey];
        return Promise.resolve(
          value === null ? null : { ...plainConfig, labelKey, value },
        );
      },
    );
  }

  it('allFilled: todas preenchidas devolve operational true', async () => {
    mockFindUniqueByValue({ KEY_A: 'a', KEY_B: 'b' });
    expect(await service.allFilled(['KEY_A', 'KEY_B'])).toEqual({
      operational: true,
    });
  });

  it('allFilled: uma vazia devolve operational false com a chave no reason', async () => {
    mockFindUniqueByValue({ KEY_A: 'a', KEY_EMPTY: '' });
    const result = await service.allFilled(['KEY_A', 'KEY_EMPTY']);
    expect(result.operational).toBe(false);
    expect(mockI18n.t).toHaveBeenCalledWith('capability.missing_keys', {
      args: { keys: 'KEY_EMPTY' },
    });
  });

  it('allFilled: uma só com espaços conta como vazia', async () => {
    mockFindUniqueByValue({ KEY_A: 'a', KEY_SPACES: '   ' });
    const result = await service.allFilled(['KEY_A', 'KEY_SPACES']);
    expect(result.operational).toBe(false);
    expect(mockI18n.t).toHaveBeenCalledWith('capability.missing_keys', {
      args: { keys: 'KEY_SPACES' },
    });
  });

  it('allFilled: chave inexistente conta como vazia', async () => {
    mockFindUniqueByValue({ KEY_A: 'a', KEY_MISSING: null });
    const result = await service.allFilled(['KEY_A', 'KEY_MISSING']);
    expect(result.operational).toBe(false);
    expect(mockI18n.t).toHaveBeenCalledWith('capability.missing_keys', {
      args: { keys: 'KEY_MISSING' },
    });
  });
});
