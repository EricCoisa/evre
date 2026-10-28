import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogClearTask } from '../../tasks/logClear.task';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { FindOneSystemConfigurationUseCase } from './find-one.use-case';
import { CreateSystemConfigurationUseCase } from './create.use-case';
import { UpdateSystemConfigurationUseCase } from './update.use-case';

/** O que o controller executa em /system-configuration. */

const mockPrisma = {
  systemConfiguration: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

describe('system-configuration use-cases', () => {
  let findOne: FindOneSystemConfigurationUseCase;
  let create: CreateSystemConfigurationUseCase;
  let update: UpdateSystemConfigurationUseCase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
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

    findOne = module.get(FindOneSystemConfigurationUseCase);
    create = module.get(CreateSystemConfigurationUseCase);
    update = module.get(UpdateSystemConfigurationUseCase);
    mockLogging.create.mockResolvedValue({});
  });

  afterEach(() => vi.clearAllMocks());

  // ─── findOne ──────────────────────────────────────────────────

  it('findOne devolve o valor em claro para config não-secreta', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    expect((await findOne.execute('cfg-1')).value).toBe('hello');
  });

  it('findOne descriptografa config secreta', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    expect((await findOne.execute('cfg-2')).value).toBe('supersecret');
    expect(mockCrypto.tryDecrypt).toHaveBeenCalled();
  });

  it('findOne trata value null', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue({
      ...plainConfig,
      value: null,
    });
    expect((await findOne.execute('cfg-1')).value).toBeNull();
  });

  it('findOne lança NotFoundException quando não existe', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    await expect(findOne.execute('missing')).rejects.toThrow(NotFoundException);
  });

  // ─── create ───────────────────────────────────────────────────

  it('create lança ConflictException quando a labelKey já existe', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    await expect(
      create.execute(
        {
          labelKey: 'SOME_KEY',
          value: 'v',
          valueType: 'STRING',
          options: [],
          secret: false,
        },
        'u1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('create grava em claro quando secret=false', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.systemConfiguration.create.mockResolvedValue(plainConfig);
    const result = await create.execute(
      {
        labelKey: 'NEW_KEY',
        value: 'hello',
        valueType: 'STRING',
        options: [],
        secret: false,
      },
      'u1',
    );
    expect(mockCrypto.encryptString).not.toHaveBeenCalled();
    expect(result.value).toBe('hello');
  });

  it('create criptografa quando secret=true', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.systemConfiguration.create.mockResolvedValue(secretConfig);
    await create.execute(
      {
        labelKey: 'SECRET_KEY',
        value: 'supersecret',
        valueType: 'STRING',
        options: [],
        secret: true,
      },
      'u1',
    );
    expect(mockCrypto.encryptString).toHaveBeenCalledWith('supersecret');
  });

  it('create derruba a sentinela de ausência no cache', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.systemConfiguration.create.mockResolvedValue(plainConfig);
    await create.execute(
      {
        labelKey: 'SOME_KEY',
        value: 'hello',
        valueType: 'STRING',
        options: [],
        secret: false,
      },
      'u1',
    );
    expect(mockRedis.del).toHaveBeenCalledWith('sysconfig:SOME_KEY');
  });

  it('create não escreve o segredo em claro no log', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    mockPrisma.systemConfiguration.create.mockResolvedValue(secretConfig);
    await create.execute(
      {
        labelKey: 'SECRET_KEY',
        value: 'supersecret',
        valueType: 'STRING',
        options: [],
        secret: true,
      },
      'u1',
    );
    expect(JSON.stringify(mockLogging.create.mock.calls[0][0])).not.toContain(
      'supersecret',
    );
  });

  // ─── update ───────────────────────────────────────────────────

  it('update lança NotFoundException quando não existe', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(null);
    await expect(update.execute('missing', { value: 'v' }, 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update recusa chave blocked — a trava de instalação', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue({
      ...plainConfig,
      labelKey: 'SYSTEMTOKEN',
      blocked: true,
    });
    await expect(
      update.execute('cfg-1', { value: 'novo' }, 'u1'),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.systemConfiguration.update).not.toHaveBeenCalled();
  });

  it('update lança ConflictException em labelKey duplicada', async () => {
    mockPrisma.systemConfiguration.findUnique
      .mockResolvedValueOnce(plainConfig)
      .mockResolvedValueOnce({ ...plainConfig, id: 'other' });
    await expect(
      update.execute('cfg-1', { labelKey: 'TAKEN_KEY' }, 'u1'),
    ).rejects.toThrow(ConflictException);
  });

  it('update criptografa quando a config é secreta', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    mockPrisma.systemConfiguration.update.mockResolvedValue({
      ...secretConfig,
      value: 'ENC:newvalue',
    });
    await update.execute('cfg-2', { value: 'newvalue' }, 'u1');
    expect(mockCrypto.encryptString).toHaveBeenCalledWith('newvalue');
  });

  it('update invalida a chave antiga e a nova no rename', async () => {
    mockPrisma.systemConfiguration.findUnique
      .mockResolvedValueOnce(plainConfig)
      .mockResolvedValueOnce(null);
    mockPrisma.systemConfiguration.update.mockResolvedValue({
      ...plainConfig,
      labelKey: 'RENAMED_KEY',
    });

    await update.execute('cfg-1', { labelKey: 'RENAMED_KEY' }, 'admin');

    expect(mockRedis.del).toHaveBeenCalledWith('sysconfig:SOME_KEY');
    expect(mockRedis.del).toHaveBeenCalledWith('sysconfig:RENAMED_KEY');
  });

  it('update reagenda o LogClearTask para SYSTEMCONFIG_LOG_DELETE_DAY', async () => {
    const logDayConfig = {
      ...plainConfig,
      labelKey: 'SYSTEMCONFIG_LOG_DELETE_DAY',
    };
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(logDayConfig);
    mockPrisma.systemConfiguration.update.mockResolvedValue(logDayConfig);
    mockLogClearTask.updateCronSchedule.mockResolvedValue(undefined);

    await update.execute('cfg-1', { value: '5' }, 'u1');
    // actionFire é fire-and-forget — espera o flush do microtask
    await Promise.resolve();

    expect(mockLogClearTask.updateCronSchedule).toHaveBeenCalled();
  });

  it('update não reagenda o LogClearTask para outras chaves', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(plainConfig);
    mockPrisma.systemConfiguration.update.mockResolvedValue(plainConfig);

    await update.execute('cfg-1', { value: 'other' }, 'u1');
    await Promise.resolve();

    expect(mockLogClearTask.updateCronSchedule).not.toHaveBeenCalled();
  });

  it.each([
    ['SYSTEM_EMAIL_SMTP_HOST', 'email:health'],
    ['SYSTEM_STORAGE_PROVIDER', 'storage:health'],
    ['SYSTEM_AI_OPENAI_MODEL', 'ai:health'],
    ['SYSTEM_AGENT_MAX_STEPS', 'ai:health'],
  ])('update derruba %s → %s', async (labelKey, healthKey) => {
    const config = { ...plainConfig, labelKey };
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(config);
    mockPrisma.systemConfiguration.update.mockResolvedValue(config);

    await update.execute('cfg-1', { value: 'v' }, 'u1');

    expect(mockRedis.del).toHaveBeenCalledWith(healthKey);
  });

  it('update trata secret null e value null', async () => {
    const nullSecret = { ...plainConfig, secret: null };
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(nullSecret);
    mockPrisma.systemConfiguration.update.mockResolvedValue({
      ...nullSecret,
      value: null,
    });
    expect((await update.execute('cfg-1', { value: 'new' }, 'u1')).value).toBeNull();
  });

  it('update não escreve o segredo em claro no log', async () => {
    mockPrisma.systemConfiguration.findUnique.mockResolvedValue(secretConfig);
    mockPrisma.systemConfiguration.update.mockResolvedValue(secretConfig);

    await update.execute('cfg-2', { value: 'supersecret' }, 'u1');

    expect(JSON.stringify(mockLogging.create.mock.calls[0][0])).not.toContain(
      'supersecret',
    );
  });
});
