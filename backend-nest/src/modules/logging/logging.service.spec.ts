import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService } from './logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientLogService } from '../client-log/client-log.service';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditProcessor } from './audit.processor';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';

const mockPrisma = {
  systemLog: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
};

const mockClientLog = {
  create: vi.fn(),
};

const mockQueue = {
  add: vi.fn().mockResolvedValue({}),
};

const baseQuery = {
  page: 1,
  limit: 10,
  pagination: false,
  search: undefined,
  filter: undefined,
};
const pagedQuery = {
  page: 1,
  limit: 10,
  pagination: true,
  search: undefined,
  filter: undefined,
};

function buildModule(withQueue: boolean) {
  return Test.createTestingModule({
    providers: [
      LoggingService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ClientLogService, useValue: mockClientLog },
      {
        provide: getQueueToken('audit'),
        useValue: withQueue ? mockQueue : null,
      },
    ],
  }).compile();
}

describe('LoggingService', () => {
  let service: LoggingService;
  let serviceWithoutQueue: LoggingService;

  beforeEach(async () => {
    service = (await buildModule(true)).get<LoggingService>(LoggingService);
    serviceWithoutQueue = (await buildModule(false)).get<LoggingService>(
      LoggingService,
    );
  });

  afterEach(() => vi.clearAllMocks());

  // ─── create (with queue) ──────────────────────────────────────

  it('create enqueues to audit queue and does not write prisma directly', async () => {
    await service.create(
      { module: 'AUTH', action: LogActions.LOGIN, message: 'msg' },
      'user-1',
    );
    expect(mockQueue.add).toHaveBeenCalledWith('write', {
      data: { module: 'AUTH', action: LogActions.LOGIN, message: 'msg' },
      performedById: 'user-1',
    });
    expect(mockPrisma.systemLog.create).not.toHaveBeenCalled();
  });

  it('create falls back to writeNow when queue.add throws', async () => {
    mockQueue.add.mockRejectedValueOnce(new Error('redis down'));
    mockPrisma.systemLog.create.mockResolvedValue({ id: '1' });
    mockClientLog.create.mockResolvedValue(null);
    await service.create(
      { module: 'AUTH', action: LogActions.LOGIN, message: 'msg' },
      'user-1',
    );
    expect(mockPrisma.systemLog.create).toHaveBeenCalled();
  });

  // ─── create (without queue — sync path) ───────────────────────

  it('create writes directly to prisma when no queue', async () => {
    mockPrisma.systemLog.create.mockResolvedValue({ id: '3' });
    mockClientLog.create.mockResolvedValue(null);
    await serviceWithoutQueue.create(
      { module: 'AUTH', action: LogActions.LOGIN, message: 'msg' },
      null,
    );
    expect(mockPrisma.systemLog.create).toHaveBeenCalled();
  });

  // ─── writeNow ─────────────────────────────────────────────────

  it('writeNow passes metadata as object (Json Prisma field — no manual stringify needed)', async () => {
    mockPrisma.systemLog.create.mockResolvedValue({ id: '2' });
    mockClientLog.create.mockResolvedValue(null);
    await service.writeNow(
      {
        module: 'SYSTEM',
        action: LogActions.UPDATE,
        message: 'x',
        metadata: { k: 'v' },
      },
      null,
    );
    const callArg = mockPrisma.systemLog.create.mock.calls[0][0];
    expect(callArg.data.metadata).toEqual({ k: 'v' });
  });

  it('writeNow swallows clientLog errors silently', async () => {
    const log = { id: '4' };
    mockPrisma.systemLog.create.mockResolvedValue(log);
    mockClientLog.create.mockRejectedValue(new Error('webhook down'));
    await expect(
      service.writeNow(
        { module: 'AUTH', action: LogActions.LOGIN, message: 'test' },
        null,
      ),
    ).resolves.toEqual(log);
  });
});

// ─── AuditProcessor ───────────────────────────────────────────────────────────

describe('AuditProcessor', () => {
  it('process calls loggingService.writeNow with job data', async () => {
    const mockLoggingService = {
      writeNow: vi.fn().mockResolvedValue({ id: '1' }),
    };
    const processor = new AuditProcessor(
      mockLoggingService as unknown as LoggingService,
    );

    const jobData = {
      data: { module: 'AUTH', action: LogActions.LOGIN, message: 'msg' },
      performedById: 'user-1',
    };
    const job = { data: jobData } as Parameters<AuditProcessor['process']>[0];
    await processor.process(job);

    expect(mockLoggingService.writeNow).toHaveBeenCalledWith(
      jobData.data,
      jobData.performedById,
    );
  });
});

describe('LoggingService — filtro por nível', () => {
  function build(minLevel: string | null) {
    const systemConfig = { getValueOrNull: vi.fn().mockResolvedValue(minLevel) };
    return Test.createTestingModule({
      providers: [
        LoggingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClientLogService, useValue: mockClientLog },
        { provide: getQueueToken('audit'), useValue: mockQueue },
        { provide: SystemConfigurationService, useValue: systemConfig },
      ],
    }).compile();
  }

  beforeEach(() => {
    mockQueue.add.mockClear();
    mockPrisma.systemLog.create.mockClear();
  });

  it('mínimo INFO descarta LOGIN antes de tocar a fila', async () => {
    const svc = (await build('INFO')).get<LoggingService>(LoggingService);

    await svc.create({ module: 'AUTH', action: LogActions.LOGIN, message: 'x' } as never, null);

    expect(mockQueue.add).not.toHaveBeenCalled();
    expect(mockPrisma.systemLog.create).not.toHaveBeenCalled();
  });

  it('mínimo INFO mantém evento de auditoria', async () => {
    const svc = (await build('INFO')).get<LoggingService>(LoggingService);

    await svc.create(
      { module: 'AUTH', action: LogActions.ACCOUNT_LOCKED, message: 'x' } as never,
      null,
    );

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });

  it('configuração ausente não emudece o log', async () => {
    const svc = (await build(null)).get<LoggingService>(LoggingService);

    await svc.create({ module: 'AUTH', action: LogActions.LOGIN, message: 'x' } as never, null);

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });

  it('valor inválido na configuração não emudece o log', async () => {
    const svc = (await build('BANANA')).get<LoggingService>(LoggingService);

    await svc.create({ module: 'AUTH', action: LogActions.LOGIN, message: 'x' } as never, null);

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });

  it('erro ao ler a configuração não emudece o log', async () => {
    const systemConfig = { getValueOrNull: vi.fn().mockRejectedValue(new Error('db fora')) };
    const mod = await Test.createTestingModule({
      providers: [
        LoggingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClientLogService, useValue: mockClientLog },
        { provide: getQueueToken('audit'), useValue: mockQueue },
        { provide: SystemConfigurationService, useValue: systemConfig },
      ],
    }).compile();
    const svc = mod.get<LoggingService>(LoggingService);

    await svc.create({ module: 'AUTH', action: LogActions.LOGIN, message: 'x' } as never, null);

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });
});
